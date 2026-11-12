// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { WorktreeLiveAgentRows } from './WorktreeLiveAgentRows'
import { TooltipProvider } from '@/components/ui/tooltip'

const store = vi.hoisted(() => ({ state: {} as Record<string, unknown> }))
vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (select: (s: Record<string, unknown>) => unknown) => select(store.state),
    {
      getState: () => store.state
    }
  )
}))
vi.mock('@/components/tab-bar/tab-agent-lineage', () => ({
  selectTabAgentParents: () => new Map([['child', 'parent']])
}))
vi.mock('./worktree-agent-orchestration-index', () => ({
  selectWorktreeAgentOrchestration: () => ({})
}))
vi.mock('./worktree-card-status-inputs', () => ({
  selectPaneForegroundAgentsForWorktree: () => ({}),
  selectLivePtyIdsForWorktree: () => ({})
}))
vi.mock('./use-worktree-agent-activation', () => ({ useWorktreeAgentActivation: () => vi.fn() }))
vi.mock('@/hooks/use-now', () => ({ useNow: () => 1000 }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => {
  document.body.innerHTML = ''
})

it('ignores saved collapse preferences, shows six rows and expands only the overflow', async () => {
  store.state = {
    tabsByWorktree: {
      workspace: ['parent', 'child', 'a', 'b', 'c', 'd', 'e'].map((id, sortOrder) => ({
        id,
        sortOrder,
        worktreeId: 'workspace',
        ptyId: `pty-${id}`,
        title: id,
        customTitle: null,
        launchAgent: 'claude',
        createdAt: 100
      }))
    },
    collapsedGroups: new Set(['ra:project-agent-open:parent', 'ra:sidebar-agent:parent']),
    unifiedTabsByWorktree: {},
    terminalLayoutsByTabId: {},
    runtimePaneTitlesByTabId: {}
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () =>
      root.render(
        <TooltipProvider>
          <WorktreeLiveAgentRows worktreeId="workspace" agents={[]} />
        </TooltipProvider>
      )
    )
    const ids = () =>
      [...container.querySelectorAll('[data-agent-tab-id]')].map((row) =>
        row.getAttribute('data-agent-tab-id')
      )
    expect(ids()).toEqual(['parent', 'child', 'a', 'b', 'c', 'd'])
    expect(container.querySelector('[data-agent-child-disclosure-button]')).toBeNull()
    const overflow = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === '+1 more'
    )!
    await act(async () => overflow.click())
    expect(ids()).toEqual(['parent', 'child', 'a', 'b', 'c', 'd', 'e'])
    expect(container.querySelectorAll('[aria-expanded]')).toHaveLength(1)
  } finally {
    await act(async () => root.unmount())
  }
})
