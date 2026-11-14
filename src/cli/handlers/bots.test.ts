import { afterEach, describe, expect, it, vi } from 'vitest'
import { BOT_COMMAND_SPECS } from '../specs/bots'
import { normalizeCommandPositionals, parseArgs, validateCommandAndFlags } from '../args'
import { BOT_HANDLERS } from './bots'
import type { RuntimeClient } from '../runtime-client'

const { readHistory, waitForChat, readBotReply } = vi.hoisted(() => ({
  readHistory: vi.fn(),
  waitForChat: vi.fn(),
  readBotReply: vi.fn()
}))
vi.mock('../selectors', () => ({
  getOptionalWorktreeSelector: async () => 'id:workspace-bots',
  resolveCurrentWorktreeSelector: async () => 'id:workspace-bots'
}))
vi.mock('../chat-history', () => ({ readHistory, waitForChat }))
vi.mock('../bot-reply', () => ({ readBotReply }))
afterEach(() => {
  vi.restoreAllMocks()
  process.exitCode = 0
})

async function run(argv: string[], failed = false) {
  readBotReply.mockResolvedValue({
    entries: [{ kind: 'message', role: 'assistant', text: 'Reviewed the brief.' }],
    truncated: false,
    nativeSessionId: 'hermes-session',
    turnOutcome: failed ? 'failure' : 'success'
  })
  const parsed = normalizeCommandPositionals(
    BOT_COMMAND_SPECS,
    parseArgs(
      argv,
      BOT_COMMAND_SPECS.map((spec) => spec.path),
      BOT_COMMAND_SPECS
    )
  )
  validateCommandAndFlags(BOT_COMMAND_SPECS, parsed)
  const requests: { method: string; params: unknown }[] = []
  const call = vi.fn(async (method: string, params: unknown) => {
    requests.push({ method, params })
    return {
      ok: true,
      result:
        method === 'bots.open'
          ? {
              sessionId: 'orca-bot-session',
              nativeSessionId: null,
              worktreeId: 'workspace-bots'
            }
          : { ok: true, value: { clientMessageId: 'message-1' } }
    }
  })
  readHistory.mockResolvedValue({
    result: {
      page: { fence: 1, ...(failed ? { latestTurn: { turn: { outcome: 'failure' } } } : {}) },
      providerSession: { id: 'hermes-session' }
    }
  })
  const output = vi.spyOn(console, 'log').mockImplementation(() => {})
  await BOT_HANDLERS[parsed.commandPath.join(' ')]({
    flags: parsed.flags,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: This CLI fixture exercises only the client's public call transport.
    client: { call } as unknown as RuntimeClient,
    cwd: '/workspace',
    json: parsed.flags.has('json')
  })
  return { requests, output: output.mock.calls.map((args) => args.join(' ')).join('\n') }
}

describe('bots CLI', () => {
  it('parses quoted messages and --new, waits for the reply and prints the native session ID', async () => {
    waitForChat.mockResolvedValue('done')
    const result = await run(['bots', 'ask', 'box:a2z', 'Review this brief', '--new', '--json'])
    expect(result.requests).toContainEqual({
      method: 'bots.open',
      params: expect.objectContaining({
        botId: 'box:a2z',
        sessionId: null,
        show: false,
        worktree: 'id:workspace-bots'
      })
    })
    expect(result.requests).toContainEqual({
      method: 'agentSession.send',
      params: expect.objectContaining({
        envelope: expect.objectContaining({ sessionId: 'orca-bot-session' }),
        body: expect.objectContaining({ blocks: [{ type: 'text', text: 'Review this brief' }] })
      })
    })
    expect(JSON.parse(result.output).result).toMatchObject({
      reply: 'Reviewed the brief.',
      sessionId: 'hermes-session',
      orcaSessionId: 'orca-bot-session',
      settled: 'done'
    })
  })
  it('reports blocked approvals with a failing exit and a usable chat identity', async () => {
    waitForChat.mockResolvedValue('blocked')
    const result = await run([
      'bots',
      'ask',
      'local:default',
      'Inspect the workspace',
      '--session',
      'saved-chat'
    ])
    expect(process.exitCode).toBe(1)
    expect(result.output).toContain('Session: hermes-session')
    expect(result.output).toContain('Bot blocked')
  })
  it('opens a specific session through the same native path', async () => {
    const result = await run(['bots', 'open', 'box:owner', '--session', 'owner-session'])
    expect(result.requests).toContainEqual({
      method: 'bots.open',
      params: expect.objectContaining({
        botId: 'box:owner',
        sessionId: 'owner-session',
        show: true
      })
    })
  })
  it('refuses conflicting session selectors before sending', async () => {
    await expect(
      run(['bots', 'ask', 'box:a2z', 'Hello', '--new', '--session', 'saved'])
    ).rejects.toThrow('Choose --session or --new')
  })
  it('does not report a failed provider turn as a successful ask', async () => {
    waitForChat.mockResolvedValue('done')
    const result = await run(['bots', 'ask', 'box:a2z', 'Review this', '--json'], true)
    expect(process.exitCode).toBe(1)
    expect(JSON.parse(result.output).result.settled).toBe('failed')
  })
})
