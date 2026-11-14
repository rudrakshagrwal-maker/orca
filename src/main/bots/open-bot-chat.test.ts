import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type * as WindowsProcessTable from '../windows/windows-process-table'
import {
  ensureStructuredAgentSessionHost,
  stopStructuredAgentSessionRuntime
} from '../runtime/agent-session/structured-agent-session-runtime'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/host/structured-agent-session-registry'
import { FakeAcpChild } from '../acp/process/testing/acp-scripted-connection.test-fixture'
import { createStructuredAgentSessionLogger } from '../native-chat/agent-session-wire/host/structured-agent-session-logger'
import { openBotChat } from './open-bot-chat'

vi.mock('./bot-profile-catalog', () => ({
  validBotId: (value: string) => /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value),
  getBotProfiles: async () => ({
    profiles: [
      {
        key: 'box:a2z',
        id: 'a2z',
        source: 'hermes',
        host: 'box',
        label: 'A2Z',
        home: '/home/hermes/.hermes/profiles/a2z',
        application: 'remote TUI',
        chats: [
          { id: 'saved-hermes', title: 'Earlier chat', preview: 'Earlier answer', updatedAt: 1000 }
        ]
      }
    ]
  })
}))
vi.mock('../windows/windows-process-table', async (original) => ({
  ...(await original<typeof WindowsProcessTable>()),
  isWindowsProcessStartTimeAvailable: () => true
}))

let root: string
let runtime: OrcaRuntimeService
let child: FakeAcpChild
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-bot-chat-'))
  const service = {
    requireStore: () => ({ getSettings: () => ({}) }),
    structuredAgentSessionLaunchSeedOptions: () => undefined,
    resolveStructuredAgentSessionCreateIntent: async () => ({
      location: {
        executionHostId: 'local',
        wslDistro: null,
        workspaceId: 'workspace-bots',
        workspaceKind: 'folder'
      },
      provider: 'hermes',
      agent: 'hermes',
      accountHome: { variable: 'HERMES_HOME', path: root },
      runtimeKind: 'native'
    }),
    publishStructuredAgentSessionTab: vi.fn(async () => {}),
    ensureStructuredAgentSessionHost: async () => {
      await ensureStructuredAgentSessionHost({
        stateDirectory: root,
        hostId: 'local',
        claimKeyId: 'bot-test-key',
        logger: createStructuredAgentSessionLogger(),
        resolveWorkspacePath: async () => root,
        resolveLaunchArgs: () => [],
        resolveClaudeAuthPolicy: () => ({ account: 'managed' }),
        resolveEnvironment: async () => ({ PATH: process.env.PATH }),
        readProcessStartTime: async () => 1700000000000,
        acpLaunchCommand: { resolveCommand: () => process.execPath },
        openAcpConnection: (launch, options) => {
          child = new FakeAcpChild(launch, options)
          child.agent.on('initialize', (frame) =>
            child.agent.reply(frame, {
              protocolVersion: 1,
              agentCapabilities: { loadSession: true }
            })
          )
          child.agent.on('session/new', (frame) =>
            child.agent.reply(frame, { sessionId: 'new-hermes' })
          )
          child.agent.on('session/load', (frame) => {
            child.agent.notify('session/update', {
              sessionId: 'saved-hermes',
              update: {
                sessionUpdate: 'user_message_chunk',
                content: { type: 'text', text: 'Earlier question' }
              }
            })
            child.agent.notify('session/update', {
              sessionId: 'saved-hermes',
              update: {
                sessionUpdate: 'agent_message_chunk',
                content: { type: 'text', text: 'Earlier answer' }
              }
            })
            child.agent.reply(frame, {})
          })
          return child
        }
      })
    }
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: This fixture implements the runtime methods used by the bot entry point.
  runtime = service as unknown as OrcaRuntimeService
})
afterEach(async () => {
  await stopStructuredAgentSessionRuntime()
  await rm(root, { recursive: true, force: true })
})

describe('bot chat through the durable native host', () => {
  it('resumes a box chat with its own profile, imports history, and reuses its existing owner', async () => {
    const ctx = { runtime, caller: { kind: 'desktop' as const } }
    const opened = await openBotChat(
      {
        botId: 'box:a2z',
        worktree: 'id:workspace-bots',
        requestId: '00000000-0000-4000-8000-000000000001'
      },
      ctx
    )
    expect(opened.nativeSessionId).toBe('saved-hermes')
    expect(child.launch.args?.at(-1)).toContain("'/home/hermes/.local/bin/hermes' '-p' 'a2z' 'acp'")
    await vi.waitFor(async () => {
      const history = await getStructuredAgentSessionHost()!.history({
        sessionId: opened.sessionId,
        direction: 'tail',
        limit: 40
      })
      expect(history.page.items.map((row) => row.body)).toContainEqual(
        expect.objectContaining({
          kind: 'message',
          role: 'assistant',
          blocks: [{ type: 'text', text: 'Earlier answer' }]
        })
      )
    })
    const reopened = await openBotChat(
      {
        botId: 'box:a2z',
        sessionId: opened.nativeSessionId!,
        worktree: 'id:workspace-bots',
        requestId: '00000000-0000-4000-8000-000000000002'
      },
      ctx
    )
    expect(reopened.sessionId).toBe(opened.sessionId)
  })
  it('starts a distinct fresh chat and rejects a session from another bot', async () => {
    const ctx = { runtime }
    const opened = await openBotChat(
      {
        botId: 'box:a2z',
        sessionId: null,
        worktree: 'id:workspace-bots',
        requestId: '00000000-0000-4000-8000-000000000003'
      },
      ctx
    )
    await vi.waitFor(async () => {
      const history = await getStructuredAgentSessionHost()!.history({
        sessionId: opened.sessionId,
        direction: 'tail',
        limit: 1
      })
      expect(history.providerSession?.id).toBe('new-hermes')
    })
    await expect(
      openBotChat(
        {
          botId: 'box:a2z',
          sessionId: 'unowned-chat',
          worktree: 'id:workspace-bots',
          requestId: '00000000-0000-4000-8000-000000000004'
        },
        ctx
      )
    ).rejects.toThrow('no longer available')
  })
})
