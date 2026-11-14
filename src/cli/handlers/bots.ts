import { randomUUID } from 'node:crypto'
import type { CommandHandler } from '../dispatch'
import {
  getOptionalStringFlag,
  getRequiredStringFlag,
  getOptionalPositiveIntegerFlag
} from '../flags'
import { getOptionalWorktreeSelector, resolveCurrentWorktreeSelector } from '../selectors'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import type { BotProfileSnapshot } from '../../shared/bot-profile-types'
import type { OpenBotChatResult } from '../../shared/bot-profile-types'
import type {
  AgentSessionMutationResult,
  AgentSessionSendResult
} from '../../shared/agent-session/agent-session-wire'
import { readHistory, waitForChat } from '../chat-history'
import { readBotReply } from '../bot-reply'
import { createStructuredAgentSessionOperationId } from '../../shared/agent-session/lifecycle/structured-agent-session-mutation'
import {
  structuredAgentSessionMessageSendMutation,
  structuredAgentSessionSendBody
} from '../../shared/agent-session/requests/structured-agent-session-send-mutation'

export const BOT_HANDLERS: Record<string, CommandHandler> = {
  'bots list': async ({ client, json }) => {
    const response = await client.call<BotProfileSnapshot>('bots.list', {})
    const bots = response.result.profiles.map((bot) => ({
      id: bot.key,
      name: bot.label,
      host: bot.host ?? 'local',
      lastActivity: bot.chats?.[0]?.updatedAt ?? null,
      preview: bot.chats?.[0]?.preview ?? '',
      ...(bot.error ? { error: bot.error } : {})
    }))
    printResult(
      {
        ...response,
        result: { bots, peers: response.result.peers ?? [], error: response.result.error }
      },
      json,
      (value) =>
        [
          ...value.bots.map(
            (bot) =>
              `${bot.id}\t${bot.name}\t${bot.host}\t${bot.lastActivity ? new Date(bot.lastActivity).toISOString() : '—'}\t${bot.preview}`
          ),
          ...value.peers.filter((peer) => peer.error).map((peer) => `${peer.name}: ${peer.error}`),
          ...(value.error ? [value.error] : [])
        ].join('\n') || 'No bots available.'
    )
  },
  'bots open': async (ctx) => {
    const response = await prepareBot(ctx, true)
    printResult(
      response,
      ctx.json,
      (result) =>
        `Opened ${result.nativeSessionId ?? result.sessionId} (Orca: ${result.sessionId}).`
    )
  },
  'bots ask': async (ctx) => {
    const text = getRequiredStringFlag(ctx.flags, 'message')
    if (!text.trim()) {
      throw new RuntimeClientError('invalid_argument', 'The message must not be empty.')
    }
    if (ctx.flags.has('new') && ctx.flags.has('session')) {
      throw new RuntimeClientError('invalid_argument', 'Choose --session or --new.')
    }
    const opened = await prepareBot(ctx, false)
    const session = opened.result.sessionId
    const page = (await readHistory(ctx.client, session, 1)).result.page
    if (page.fence === undefined) {
      throw new RuntimeClientError('agent_session_not_running', 'Bot chat is unavailable.')
    }
    const mutation = structuredAgentSessionMessageSendMutation({
      sessionId: session,
      clientOperationId: createStructuredAgentSessionOperationId(randomUUID),
      expectedRuntimeFence: page.fence,
      body: structuredAgentSessionSendBody(text, []),
      delivery: 'queue-if-active'
    })
    const sent = await ctx.client.call<AgentSessionMutationResult<AgentSessionSendResult>>(
      'agentSession.send',
      mutation
    )
    if (!sent.result.ok) {
      throw new RuntimeClientError(sent.result.refusal.code, sent.result.refusal.message)
    }
    const value = sent.result.value
    const settled = await waitForChat(
      ctx.client,
      session,
      getOptionalPositiveIntegerFlag(ctx.flags, 'timeout-ms') ?? 600_000,
      'queued' in value ? value.queued.messageId : undefined
    )
    const turn = await readBotReply(ctx.client, session, value.clientMessageId, settled)
    const failed =
      settled === 'done' &&
      ((turn.turnOutcome !== undefined && turn.turnOutcome !== 'success') ||
        turn.entries.some((entry) => entry.kind === 'error'))
    const outcome = failed ? 'failed' : settled
    const reply = turn.entries
      .filter((entry) => entry.kind === 'message' && entry.role === 'assistant')
      .map((entry) => (entry.kind === 'message' ? entry.text : ''))
      .join('\n')
    if (outcome !== 'done') {
      process.exitCode = 1
    }
    printResult(
      {
        ...sent,
        result: {
          botId: getRequiredStringFlag(ctx.flags, 'bot-id'),
          sessionId: turn.nativeSessionId ?? opened.result.nativeSessionId ?? session,
          orcaSessionId: session,
          reply,
          settled: outcome,
          entries: turn.entries,
          truncated: turn.truncated
        }
      },
      ctx.json,
      (result) =>
        `${result.reply}${result.reply ? '\n' : ''}Session: ${result.sessionId}\n${outcome === 'done' ? '' : `Bot ${outcome}; open its chat in Orca to continue.`}`.trim()
    )
  }
}

async function prepareBot(ctx: Parameters<CommandHandler>[0], show: boolean) {
  const worktree =
    (await getOptionalWorktreeSelector(ctx.flags, 'worktree', ctx.cwd, ctx.client)) ??
    (await resolveCurrentWorktreeSelector(ctx.cwd, ctx.client))
  const sessionId = ctx.flags.has('new') ? null : getOptionalStringFlag(ctx.flags, 'session')
  return ctx.client.call<OpenBotChatResult>(
    'bots.open',
    {
      botId: getRequiredStringFlag(ctx.flags, 'bot-id'),
      ...(sessionId !== undefined ? { sessionId } : {}),
      worktree,
      requestId: randomUUID(),
      show
    },
    { timeoutMs: 60_000 }
  )
}
