import { afterEach, expect, it, vi } from 'vitest'
import { admitRestoredAgentStart } from './restored-agent-start-admission'
import type { ConnectPanePtySession } from '../connect-pane-pty-session'

vi.mock('@/store/index', () => ({ useAppStore: { getState: () => ({ activeTabId: 'active' }) } }))
afterEach(() => vi.useRealTimers())

// RA: exercise the renderer adapter shared by reconnect and fallback launch paths.
it('starts the active restored pane first and drops a closed waiting pane', async () => {
  vi.useFakeTimers()
  const pane = (tabId: string) =>
    ({
      disposed: false,
      transportStreamGeneration: 1,
      deps: { tabId }
    }) as unknown as ConnectPanePtySession
  const closed = pane('hidden')
  const startClosed = vi.fn(async () => 'closed-pty')
  const hidden = admitRestoredAgentStart(closed, 'claude', startClosed)
  const activeStart = vi.fn(async () => 'active-pty')
  const active = admitRestoredAgentStart(pane('active'), 'codex', activeStart)
  await vi.advanceTimersByTimeAsync(0)
  await expect(active).resolves.toBe('active-pty')
  expect(startClosed).not.toHaveBeenCalled()
  closed.disposed = true
  await vi.advanceTimersByTimeAsync(150)
  await expect(hidden).resolves.toBeNull()
  expect(startClosed).not.toHaveBeenCalled()
  await vi.runAllTimersAsync()
})
