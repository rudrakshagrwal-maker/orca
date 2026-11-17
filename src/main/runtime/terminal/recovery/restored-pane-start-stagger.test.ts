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
