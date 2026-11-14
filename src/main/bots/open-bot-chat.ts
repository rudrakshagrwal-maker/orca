import { randomUUID } from 'node:crypto'
import { getBotProfiles } from './bot-profile-catalog'
import { validSessionId } from './hermes-chat-reader'
import { resolveHermesPeers } from '../../shared/hermes-peers'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/host/structured-agent-session-registry'
import { agentSessionProviderHandleChainHead } from '../../shared/agent-session/lifecycle/agent-session-provider-handle'
import { computeAgentSessionPayloadFingerprint } from '../../shared/agent-session/lifecycle/agent-session-mutation-envelope'
import { createStructuredAgentSessionOperationId } from '../../shared/agent-session/lifecycle/structured-agent-session-mutation'
import { attachFingerprintFields } from '../native-chat/agent-session-wire/acquisition/structured-agent-session-attach'
import type { RpcContext } from '../runtime/rpc/core'
import { structuredCallerFor } from '../runtime/rpc/methods/structured-sessions/creation/structured-agent-session-gate'
import {
  prepareStructuredAgentSessionCreateForWorktree,
  commitStructuredAgentSessionCreate
} from '../runtime/rpc/methods/structured-sessions/creation/structured-agent-session-create'

export type OpenBotChatInput = {
  botId: string
  sessionId?: string | null
  worktree: string
  requestId: string
  show?: boolean
}
export type OpenBotChatResult = {
  sessionId: string
  nativeSessionId: string | null
  worktreeId: string
}
const flights = new Map<string, Promise<OpenBotChatResult>>()

export function openBotChat(input: OpenBotChatInput, ctx: RpcContext): Promise<OpenBotChatResult> {
  const flightKey = input.botId
  const previous = flights.get(flightKey) ?? Promise.resolve(null)
  const pending = previous.catch(() => null).then(() => open(input, ctx))
  flights.set(flightKey, pending)
  void pending
    .finally(() => {
      if (flights.get(flightKey) === pending) {
        flights.delete(flightKey)
      }
    })
    .catch(() => {})
  return pending
}

async function open(input: OpenBotChatInput, ctx: RpcContext): Promise<OpenBotChatResult> {
  const peers = resolveHermesPeers(ctx.runtime.requireStore().getSettings().hermesPeers)
  const profile = (await getBotProfiles(true, peers)).profiles.find((p) => p.key === input.botId)
  if (!profile) {
    throw new Error('Bot unavailable. Refresh Bots and check SSH.')
  }
  await ctx.runtime.ensureStructuredAgentSessionHost()
  const host = getStructuredAgentSessionHost()
  if (!host) {
    throw new Error('Native chat is unavailable')
  }
  const records = host.deps.store
    .listRecords()
    .filter(
      (record) =>
        record.provider === 'hermes' &&
        record.launchArgs?.[0] === '--orca-bot' &&
        record.launchArgs[1] === profile.key &&
        'path' in record.accountHome &&
        record.accountHome.path === profile.home
    )
  const selected = input.sessionId === undefined ? profile.chats?.[0]?.id : input.sessionId
  const existing =
    records.find((record) => record.sessionId === `bot-${input.requestId}`) ??
    (selected
      ? records.find(
          (record) =>
            record.sessionId === selected ||
            agentSessionProviderHandleChainHead(record.providerHandleChain)?.handle.nativeId ===
              selected
        )
      : undefined)
  if (existing) {
    if (input.show !== false) {
      await ctx.runtime.publishStructuredAgentSessionTab({
        workspaceId: existing.location.workspaceId,
        sessionId: existing.sessionId,
        agent: 'hermes',
        activate: true
      })
    }
    return {
      sessionId: existing.sessionId,
      nativeSessionId:
        agentSessionProviderHandleChainHead(existing.providerHandleChain)?.handle.nativeId ?? null,
      worktreeId: existing.location.workspaceId
    }
  }
  if (
    selected &&
    (!validSessionId(selected) || !profile.chats?.some((chat) => chat.id === selected))
  ) {
    throw new Error('Chat is no longer available. Refresh Bots.')
  }
  if (input.sessionId === undefined && profile.error) {
    throw new Error(profile.error)
  }
  const sessionId = `bot-${input.requestId}`
  const caller = structuredCallerFor(ctx)
  const prepared = await prepareStructuredAgentSessionCreateForWorktree({
    runtime: ctx.runtime,
    ensureHost: async () => host,
    caller,
    worktree: input.worktree,
    agent: 'hermes',
    envelope: {
      sessionId,
      clientOperationId: createStructuredAgentSessionOperationId(randomUUID),
      expectedRuntimeFence: null,
      payloadFingerprint: ''
    }
  })
  prepared.attachParams.accountHome = { variable: 'HERMES_HOME', path: profile.home }
  prepared.attachParams.launchArgs = ['--orca-bot', profile.key]
  prepared.attachParams.options = { permissionMode: 'ask' }
  if (selected) {
    prepared.attachParams.adopt = {
      providerHandle: { transport: 'acp', agent: 'hermes', nativeId: selected },
      replayViaAcp: true,
      conversationName: profile.chats?.find((chat) => chat.id === selected)?.title
    }
  }
  prepared.attachParams.envelope.payloadFingerprint = computeAgentSessionPayloadFingerprint({
    method: 'agentSession.attach',
    sessionId,
    fields: attachFingerprintFields(prepared.attachParams)
  })
  if (input.show === false) {
    prepared.tab = null
  }
  const result = await commitStructuredAgentSessionCreate({
    runtime: ctx.runtime,
    caller,
    prepared,
    activate: input.show !== false
  })
  if (!result.ok) {
    throw new Error(result.refusal.message)
  }
  const record = host.deps.store.getRecord(sessionId)
  return {
    sessionId,
    nativeSessionId: record
      ? (agentSessionProviderHandleChainHead(record.providerHandleChain)?.handle.nativeId ?? null)
      : null,
    worktreeId: prepared.attachParams.location.workspaceId
  }
}
