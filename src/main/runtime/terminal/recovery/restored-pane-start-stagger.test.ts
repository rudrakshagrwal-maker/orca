import { afterEach, expect, it, vi } from 'vitest'
import { RestoredPaneStarter } from './restored-pane-start'

afterEach(() => vi.useRealTimers())

// RA: test actual main-owned restore admission, including immediate shells and closed queued panes.
it('starts active agents first and rechecks a waiting pane before spawning', async () => {
  vi.useFakeTimers()
  const started: string[] = []
  const closed = new Set<string>()
  const starter = new RestoredPaneStarter({
    boundPtyId: (pane) => (closed.has(pane.tabId) ? null : undefined),
    isLive: () => false,
    agent: (pane) => (pane.tabId === 'shell' ? undefined : 'claude'),
    active: (pane) => pane.tabId === 'active',
    start: async (pane) => {
      started.push(pane.tabId)
      return { id: `pty-${pane.tabId}` }
    }
  })
  const pane = (tabId: string) => ({
    worktreeId: 'workspace',
    tabId,
    leafId: '11111111-1111-4111-8111-111111111111'
  })
  const hidden = starter.ensureStarted(pane('hidden'))
  const active = starter.ensureStarted(pane('active'))
  const shell = starter.ensureStarted(pane('shell'))
  await shell
  expect(started).toEqual(['shell'])
  await vi.advanceTimersByTimeAsync(0)
  await expect(active).resolves.toEqual({ id: 'pty-active' })
  expect(started).toEqual(['shell', 'active'])
  closed.add('hidden')
  await vi.advanceTimersByTimeAsync(150)
  await expect(hidden).resolves.toBeNull()
  expect(started).toEqual(['shell', 'active'])
  await vi.runAllTimersAsync()
})

// RA: a restored agent whose saved folder is gone fails fast, frees the queue, and a Retry starts it once.
it('does not let a missing-folder failure block the queue, and Retry or root start runs exactly once', async () => {
  vi.useFakeTimers()
  const calls: { tabId: string; inWorkspaceRoot?: true }[] = []
  const failures: string[] = []
  const starter = new RestoredPaneStarter({
    boundPtyId: () => undefined,
    isLive: () => false,
    agent: () => 'claude',
    active: () => true,
    failed: (pane) => failures.push(pane.tabId),
    start: async (pane, _plan, trigger) => {
      calls.push({ tabId: pane.tabId, inWorkspaceRoot: trigger.inWorkspaceRoot })
      if (pane.tabId === 'gone' && !trigger.inWorkspaceRoot) {
        throw new Error('startup_cwd_missing: saved folder is unavailable')
      }
      return { id: `pty-${pane.tabId}` }
    }
  })
  const pane = (tabId: string) => ({
    worktreeId: 'workspace',
    tabId,
    leafId: '11111111-1111-4111-8111-111111111111'
  })
  const gone = starter.ensureStarted(pane('gone'))
  const other = starter.ensureStarted(pane('other'))
  const goneResult = gone.catch((error: Error) => error.message)
  await vi.advanceTimersByTimeAsync(0)
  await expect(goneResult).resolves.toContain('startup_cwd_missing')
  await vi.advanceTimersByTimeAsync(150)
  await expect(other).resolves.toEqual({ id: 'pty-other' })
  expect(failures).toEqual(['gone'])

  const root = starter.ensureStarted(pane('gone'), { inWorkspaceRoot: true })
  const sameRoot = starter.ensureStarted(pane('gone'), { inWorkspaceRoot: true })
  await vi.advanceTimersByTimeAsync(300)
  await expect(root).resolves.toEqual({ id: 'pty-gone' })
  await expect(sameRoot).resolves.toEqual({ id: 'pty-gone' })
  expect(calls.filter((call) => call.tabId === 'gone')).toEqual([
    { tabId: 'gone', inWorkspaceRoot: undefined },
    { tabId: 'gone', inWorkspaceRoot: true }
  ])
  await vi.runAllTimersAsync()
})
