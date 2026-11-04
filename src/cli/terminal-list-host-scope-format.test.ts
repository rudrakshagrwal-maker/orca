import { describe, expect, it } from 'vitest'
import { formatTerminalList } from './format'
import type { RuntimeTerminalListResult, RuntimeTerminalSummary } from '../shared/runtime-types'

function terminal(overrides: Partial<RuntimeTerminalSummary> = {}): RuntimeTerminalSummary {
  return {
    handle: 'term_1',
    ptyId: 'pty-1',
    worktreeId: 'repo::/repo',
    worktreePath: '/repo',
    branch: 'main',
    tabId: 'tab-1',
    leafId: 'leaf-1',
    title: 'worker',
    connected: true,
    writable: true,
    lastOutputAt: null,
    preview: '',
    ...overrides
  }
}

function listResult(overrides: Partial<RuntimeTerminalListResult> = {}): RuntimeTerminalListResult {
  return { terminals: [terminal()], totalCount: 1, truncated: false, ...overrides }
}

describe('formatTerminalList pane titles', () => {
  it("prints a pane's user name over the terminal title, and the title when the host sends none", () => {
    const named = formatTerminalList(listResult({ terminals: [terminal({ paneTitle: 'server' })] }))
    // RA: short text rows keep unknown agent/state/age explicit.
    expect(named).toContain('1  server  -  -  -')
    expect(formatTerminalList(listResult())).toContain('1  worker  -  -  -')
  })
})

// RA: normal listings are compact; raw previews and layout topology need explicit flags.
describe('formatTerminalList compact rows', () => {
  it('aligns short handles, titles, agents, OSC states and tab ages, including sleepers', () => {
    const list = formatTerminalList(
      listResult({
        terminals: [
          terminal({
            handle: 'term_bd3c1234-0000-4000-8000-000000000000',
            title: 'cook',
            agentIdentity: 'codex',
            state: 'working',
            createdAt: 1_000,
            preview: 'raw output'
          }),
          terminal({
            handle: 'term_abcd1234-0000-4000-8000-000000000000',
            title: 'sleep\nnow',
            connected: false,
            agentIdentity: 'claude',
            state: 'sleeping',
            createdAt: 61_000
          })
        ],
        totalCount: 2,
        hostScope: { hostIds: ['local'], omittedHostIds: [] }
      }),
      { now: 121_000 }
    )
    expect(list.split('\n')).toEqual([
      'bd3c1234  cook       codex   working   2m',
      'abcd1234  sleep now  claude  sleeping  1m'
    ])
    expect(list).not.toContain('raw output')
  })

  it('shows previews only on request and suppresses ordinary scope boilerplate', () => {
    const result = listResult({
      terminals: [terminal({ preview: 'one\ntwo' })],
      hostScope: { hostIds: ['local'], omittedHostIds: [] }
    })
    expect(formatTerminalList(result)).toBe('1  worker  -  -  -')
    expect(formatTerminalList(result, { preview: true })).toContain('\npreview: one two')
  })
})

// RA: scope metadata remains intact for JSON but does not add rows to the compact view.
describe('formatTerminalList scope metadata', () => {
  it('omits metadata from text without changing the result', () => {
    const result = listResult({ hostScope: { hostIds: ['local'], omittedHostIds: ['ssh:box-1'] } })
    const before = JSON.stringify(result)
    const output = formatTerminalList(result)
    expect(output).toBe('1  worker  -  -  -')
    expect(JSON.stringify(result)).toBe(before)
  })

  it('prints a short empty result', () => {
    const output = formatTerminalList(
      listResult({
        terminals: [],
        totalCount: 0,
        hostScope: { hostIds: ['local'], omittedHostIds: ['ssh:box-1'] }
      })
    )

    expect(output).toBe('No terminals listed.')
  })

  it('supports hosts that predate scope metadata', () => {
    const output = formatTerminalList(listResult())

    expect(output).toBe('1  worker  -  -  -')
  })
})
