// RA: Retain Claude and Codex while removing unused integrations and usage tracking.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RelayAgentHookServer } from '../../../../../wsl-guest/agent-hook-server'
import { AgentHookServer, _internals } from '../../agent-hook-server'

import { buildBody, PANE, postHookEvent } from '../server.test-fixtures'

vi.mock('electron', () => ({
  BrowserWindow: { fromId: vi.fn(() => null) },
  webContents: { fromId: vi.fn(() => null) },
  ipcMain: { on: vi.fn(), removeListener: vi.fn() },
  app: { getPath: vi.fn(() => '/tmp') }
}))

vi.mock('../../../../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../../../../telemetry/cohort-classifier', () => ({ getCohortAtEmit: vi.fn(() => ({})) }))

type CapturedHook = { scenario: string; kind: string; payload?: Record<string, unknown> }
const hooks: CapturedHook[] = readFileSync(
  join(
    import.meta.dirname,
    '../../../../../shared/__fixtures__/claude-task-notification-hooks.jsonl'
  ),
  'utf8'
)
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
const SESSION = '00000000-0000-4000-8000-000000000000'

beforeEach(() => {
  _internals.resetCachesForTests()
})
afterEach(() => vi.useRealTimers())

async function host(remote: boolean, launchToken?: string) {
  const desktop = new AgentHookServer()
  const dir = mkdtempSync(join(tmpdir(), 'orca-task-wakeup-'))
  const relay = remote
    ? new RelayAgentHookServer({
        endpointDir: dir,
        forward: (envelope) => desktop.ingestRemote(envelope, 'ssh-owner')
      })
    : null
  const unsubscribeInterrupt = relay
    ? desktop.subscribeRemoteInterruptRequests(({ request }) => relay.inferInterrupt(request))
    : null
  await desktop.start({ env: 'production' })
  await relay?.start({ publishEndpoint: false })
  const post = async (payload: Record<string, unknown>) => {
    const body = buildBody({ session_id: SESSION, ...payload }, { launchToken })
    const response = relay
      ? await fetch(`http://127.0.0.1:${relay.getCoordinates().port}/hook/claude`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Advancing fake time can expire a pooled HTTP socket before the next post.
            Connection: 'close',
            'X-Orca-Agent-Hook-Token': relay.getCoordinates().token
          },
          body: JSON.stringify(body)
        })
      : await postHookEvent(desktop, body)
    expect(response.status).toBe(204)
  }
  const row = () => desktop.getStatusSnapshotForPane(PANE)[0]
  const stop = () => {
    unsubscribeInterrupt?.()
    relay?.stop()
    desktop.stop()
    rmSync(dir, { recursive: true, force: true })
  }
  return { desktop, post, row, stop }
}

describe.each([false, true])('Claude wake-up production ingress remote=%s', (remote) => {
  it.each([
    'one-subagent',
    'two-subagents-together',
    'subagent-resumed',
    'subagent-with-own-shell',
    'two-shells-together'
  ])('%s never exposes completion before the final captured wake-up', async (scenario) => {
    const server = await host(remote)
    const records = hooks.filter((record) => record.scenario === scenario && record.payload)
    const finalWakeup = records.findLastIndex(
      (record) =>
        record.payload?.hook_event_name === 'UserPromptSubmit' &&
        String(record.payload.prompt).startsWith('<task-notification>')
    )
    expect(finalWakeup).toBeGreaterThan(0)
    const prematureCompletion: number[] = []
    try {
      for (const [index, record] of records.entries()) {
        await server.post(record.payload!)
        const row = server.row()
        if (index < finalWakeup && row?.state === 'done' && !row.sessionBoundary) {
          prematureCompletion.push(index)
        }
      }
      expect(prematureCompletion).toEqual([])
      expect(server.row()).toMatchObject({
        state: 'done',
        connectionId: remote ? 'ssh-owner' : null
      })
    } finally {
      server.stop()
    }
  })
})

describe.each([false, true])('Claude cancellation with an owed wake-up remote=%s', (remote) => {
  it.each([false, true])(
    'keeps cancellation bounded unless a new prompt opens a turn: %s',
    async (newTurn) => {
      vi.useFakeTimers({
        shouldAdvanceTime: true,
        toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout']
      })
      const server = await host(remote)
      {
        await server.post({ hook_event_name: 'UserPromptSubmit', prompt: 'delegate' })
        await server.post({ hook_event_name: 'SubagentStart', agent_id: 'a1' })
        await server.post({
          hook_event_name: 'PostToolUse',
          tool_name: 'Agent',
          tool_response: { isAsync: true, agentId: 'a1' }
        })
        await server.post({ hook_event_name: 'SubagentStop', agent_id: 'a1' })
        const baseline = server.row()!
        expect(
          server.desktop.inferInterrupt({
            paneKey: PANE,
            baselineUpdatedAt: baseline.receivedAt,
            baselineStateStartedAt: baseline.stateStartedAt,
            baselinePrompt: baseline.prompt,
            baselineAgentType: 'claude',
            intent: 'ctrl-c'
          })
        ).toBe(true)
        expect(server.row()).toMatchObject({
          mainAgent: { state: 'done', outcome: 'cancellation' }
        })
        await server.post({
          hook_event_name: 'PostToolUse',
          tool_name: 'Read',
          tool_response: { content: 'late result' }
        })
        if (newTurn) {
          await server.post({ hook_event_name: 'UserPromptSubmit', prompt: 'start a fresh turn' })
        }
        vi.advanceTimersByTime(120_000)
        if (newTurn) {
          expect(server.row()).toMatchObject({ state: 'working', mainAgent: { state: 'working' } })
          expect(server.row()?.mainAgent).not.toHaveProperty('outcome')
          await server.post({ hook_event_name: 'Stop', background_tasks: [] })
          vi.advanceTimersByTime(60_000)
          expect(server.row()?.state).toBe('done')
        } else {
          expect(server.row()).toMatchObject({
            state: 'done',
            interrupted: true,
            mainAgent: { state: 'done', outcome: 'cancellation' }
          })
        }
      }
    }
  )
})

describe('Claude finishing turn permission restoration', () => {
  it.each(['lead', 'child'])(
    'retains the cycle through a %s question and clears it on Stop or a fresh prompt',
    async (owner) => {
      const server = await host(false)
      try {
        await server.post({ hook_event_name: 'UserPromptSubmit', prompt: 'delegate' })
        await server.post({ hook_event_name: 'SubagentStart', agent_id: 'a1' })
        await server.post({
          hook_event_name: 'PostToolUse',
          tool_name: 'Agent',
          tool_response: { isAsync: true, agentId: 'a1' }
        })
        await server.post({ hook_event_name: 'SubagentStop', agent_id: 'a1' })
        await server.post({
          hook_event_name: 'UserPromptSubmit',
          prompt: '<task-notification><task-id>a1</task-id><status>completed</status>'
        })
        expect(server.row()?.claudeTaskWakeupPending).toBe('finishing-turn')
        const child = owner === 'child' ? { agent_id: 'child-question' } : {}
        await server.post({
          hook_event_name: 'PreToolUse',
          tool_name: 'AskUserQuestion',
          tool_use_id: 'question',
          ...child
        })
        expect(server.row()).toMatchObject({
          state: 'waiting',
          claudeTaskWakeupPending: 'finishing-turn'
        })
        const baseline = server.row()!
        expect(
          server.desktop.inferQuestionAnswered({
            paneKey: PANE,
            baselineUpdatedAt: baseline.receivedAt,
            baselineStateStartedAt: baseline.stateStartedAt,
            baselinePrompt: baseline.prompt,
            baselineAgentType: 'claude'
          })
        ).toBe(true)
        await server.post({ hook_event_name: 'PostToolUse', tool_name: 'Read', tool_response: {} })
        expect(server.row()).toMatchObject({
          mainAgent: { state: 'working' },
          claudeTaskWakeupPending: 'finishing-turn'
        })
        if (owner === 'lead') {
          await server.post({ hook_event_name: 'UserPromptSubmit', prompt: 'a fresh typed turn' })
          expect(server.row()?.claudeTaskWakeupPending).toBeUndefined()
        }
        await server.post({ hook_event_name: 'Stop', background_tasks: [] })
        expect(server.row()?.claudeTaskWakeupPending).toBeUndefined()
      } finally {
        server.stop()
      }
    }
  )
})
