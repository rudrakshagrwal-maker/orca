import { describe, expect, it, vi } from 'vitest'
import type { RuntimeTerminalListResult, RuntimeTerminalSummary } from '../shared/runtime-types'
import { matchTerminalHandle, TerminalHandleSelector } from './terminal-handle-selector'

const FIRST = 'term_bd3c1234-0000-4000-8000-000000000001'
const SECOND = 'term_bd3d1234-0000-4000-8000-000000000002'
const terminals = [
  { handle: FIRST, title: 'Cook CLI', paneTitle: 'implementation' },
  { handle: SECOND, title: 'Review CLI' }
] as RuntimeTerminalSummary[]

// RA: selector coverage includes collisions between names and IDs and a complete inventory fence.
describe('short terminal handles', () => {
  it.each(['bd3c', 'term_bd3c', 'BD3C', 'cOoK', 'IMPLEMENT'])('resolves %s', (selector) => {
    expect(matchTerminalHandle(selector, terminals)).toBe(FIRST)
  })

  it('lists every ambiguous match and refuses missing names', () => {
    for (const selector of ['bd3', 'cli']) {
      expect(() => matchTerminalHandle(selector, terminals)).toThrow(FIRST)
      expect(() => matchTerminalHandle(selector, terminals)).toThrow(SECOND)
    }
    expect(() => matchTerminalHandle('missing', terminals)).toThrow('No terminal matches')
    expect(() =>
      matchTerminalHandle('bd3c', [...terminals, { ...terminals[1], title: 'bd3c title' }])
    ).toThrow('Ambiguous')
  })

  it('keeps full handles and bare UUIDs free of inventory RPCs, including closed terminals', async () => {
    const list = vi.fn<() => Promise<RuntimeTerminalListResult>>()
    const selector = new TerminalHandleSelector(list)
    expect(await selector.resolve(FIRST)).toBe(FIRST)
    expect(await selector.resolve(FIRST.slice(5))).toBe(FIRST)
    expect(await selector.resolve('term_legacy')).toBe('term_legacy')
    expect(await selector.resolve('orca_session_id:abc')).toBe('orca_session_id:abc')
    expect(list).not.toHaveBeenCalled()
  })

  it('shares one inventory for terminal, parent and orchestration target flags', async () => {
    const list = vi.fn(async () => ({ terminals, totalCount: 2, truncated: false }))
    const selector = new TerminalHandleSelector(list)
    expect(
      await selector.params('terminal.setParent', { terminal: 'cook', parent: 'review' })
    ).toEqual({ terminal: FIRST, parent: SECOND })
    expect(
      await selector.params('orchestration.send', { from: 'cook', to: 'review', body: '/home/x' })
    ).toEqual({ from: FIRST, to: SECOND, body: '/home/x' })
    expect(await selector.params('agent.launch', { parentTerminalHandle: 'cook' })).toEqual({
      parentTerminalHandle: FIRST
    })
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('leaves non-handle parents and task status targets untouched', async () => {
    const list = vi.fn<() => Promise<RuntimeTerminalListResult>>()
    const selector = new TerminalHandleSelector(list)
    expect(await selector.params('linear.create', { parent: 'ABC-123', to: 'done' })).toEqual({
      parent: 'ABC-123', to: 'done'
    })
    expect(await selector.params('orchestration.taskCreate', { parent: 'task-id' })).toEqual({
      parent: 'task-id'
    })
    const addresses = { from: 'codex_12345678_1234_4234_8234_123456789012', to: '@workers' }
    expect(await selector.params('orchestration.send', addresses)).toEqual(addresses)
    expect(await selector.params('orchestration.send', { to: 'dispatch:dispatch-1' })).toEqual({
      to: 'dispatch:dispatch-1'
    })
    expect(list).not.toHaveBeenCalled()
  })

  it('accepts punctuation in tab-title substrings', () => {
    expect(matchTerminalHandle('cook:', [{ ...terminals[0], title: 'Cook: CLI' }])).toBe(FIRST)
  })

  it('refuses to infer uniqueness from a truncated inventory', async () => {
    const selector = new TerminalHandleSelector(async () => ({
      terminals, totalCount: 3, truncated: true
    }))
    await expect(selector.resolve('cook')).rejects.toMatchObject({
      code: 'terminal_selector_incomplete'
    })
  })
})
