// RA: Closing a revealed worker hides its view while retaining tab and PTY identity.
import { describe, expect, it, vi } from 'vitest'
import { createTestStore, seedStore } from '@/store/testing/app-store-test-fixture'
import { makeTab } from '@/store/terminals/terminal-tab.test-fixture'
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import { hideWorkerTabOnClose, isWorkerTabHidden, revealWorkerTab } from './worker-tab-visibility'
vi.mock('../sidebar/workspace-card/activity/worktree-agent-orchestration-index', () => ({ selectWorktreeAgentOrchestration: () => ({}) }))
vi.mock('../tab-bar/tab-agent-lineage', () => ({ selectTabAgentParents: () => new Map([['worker', 'parent']]) }))

describe('worker terminal visibility', () => {
  it('starts hidden, opens on demand, then hides without retiring its PTY', () => {
    const store = createTestStore()
    seedStore(store, {
      tabsByWorktree: { project: [makeTab({ id: 'parent', worktreeId: 'project' }), makeTab({ id: 'worker', worktreeId: 'project', customTitle: 'worker-task_123', ptyId: 'live-worker-pty' })] }
    })
    expect(isWorkerTabHidden(store.getState(), 'project', 'worker')).toBe(true)
    revealWorkerTab('worker')
    expect(isWorkerTabHidden(store.getState(), 'project', 'worker')).toBe(false)
    expect(hideWorkerTabOnClose(store.getState(), 'worker')).toBe(true)
    expect(isWorkerTabHidden(store.getState(), 'project', 'worker')).toBe(true)
    expect(store.getState().tabsByWorktree.project?.find((t) => t.id === 'worker')?.ptyId).toBe('live-worker-pty')
  })
  it('keeps shown mode available and leaves ordinary terminals alone', () => {
    const store = createTestStore()
    seedStore(store, { tabsByWorktree: { project: [makeTab({ id: 'ordinary', worktreeId: 'project' }), makeTab({ id: 'shown', worktreeId: 'project', customTitle: 'worker-task_456' })] } })
    expect(hideWorkerTabOnClose(store.getState(), 'ordinary')).toBe(false)
    store.setState({ settings: createGlobalSettingsFixture({ workerTabsShown: true }) })
    expect(isWorkerTabHidden(store.getState(), 'project', 'shown')).toBe(false)
    expect(hideWorkerTabOnClose(store.getState(), 'shown')).toBe(false)
  })
})
