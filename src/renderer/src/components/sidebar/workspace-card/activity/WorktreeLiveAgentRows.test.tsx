// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { WorktreeLiveAgentRows } from './WorktreeLiveAgentRows'
import { TooltipProvider } from '@/components/ui/tooltip'
import { buildWorktreeAgentRows } from './worktree-agent-rows'
import type { TerminalTab } from '../../../../../../shared/workspace-layout/terminal-tab-types'

const store = vi.hoisted(() => ({ state: {} as Record<string, unknown> }))
const activate = vi.hoisted(() => vi.fn())
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
vi.mock('./use-worktree-agent-activation', () => ({ useWorktreeAgentActivation: () => activate }))
vi.mock('@/hooks/use-now', () => ({ useNow: () => 600_000 }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => {
  document.body.innerHTML = ''
  activate.mockClear()
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

it('shows icon-only states and discloses subagents under their owning tab', async () => {
  const tab: TerminalTab = {
    id: 'parent',
    worktreeId: 'workspace',
    title: 'Parent task',
    customTitle: null,
    color: null,
    ptyId: 'pty-parent',
    launchAgent: 'claude',
    sortOrder: 0,
    createdAt: 300_000
  }
  const paneKey = 'parent:11111111-1111-4111-8111-111111111111'
  const agents = buildWorktreeAgentRows({
    tabs: [tab],
    entries: [
      {
        paneKey,
        tabId: tab.id,
        worktreeId: tab.worktreeId,
        agentType: 'claude',
        prompt: 'Parent task',
        state: 'working',
        stateStartedAt: 300_000,
        updatedAt: 600_000,
        stateHistory: [],
        children: [
          {
            id: 'review',
            providerId: 'review',
            kind: 'agent',
            name: 'Review routing',
            agentType: 'codex',
            state: 'blocked',
            membership: 'live',
            firstObservedAt: 420_000,
            observedAt: 600_000,
            stoppable: true,
            invocation: { invocationId: 'review', generation: 1 }
          }
        ]
      }
    ],
    retained: [],
    now: 600_000
  })
  expect(agents.map((agent) => agent.rowSource)).toEqual(['live', 'subagent'])
  store.state = { tabsByWorktree: { workspace: [tab] }, unifiedTabsByWorktree: {} }

  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () =>
      root.render(
        <TooltipProvider>
          <WorktreeLiveAgentRows worktreeId="workspace" agents={agents} />
        </TooltipProvider>
      )
    )
    const parent = container.querySelector<HTMLButtonElement>('[data-agent-tab-id="parent"]')!
    expect(parent.textContent).toBe('Parent task5m')
    expect(parent.querySelector('[aria-label="Working"]')).not.toBeNull()
    const disclosure = container.querySelector<HTMLButtonElement>(
      '[data-agent-child-disclosure-button]'
    )!
    expect(disclosure.textContent).toBe('+1')
    expect(disclosure.getAttribute('aria-expanded')).toBe('false')
    expect(container.textContent).not.toContain('Review routing')

    await act(async () => disclosure.click())
    expect(disclosure.getAttribute('aria-expanded')).toBe('true')
    expect(activate).not.toHaveBeenCalled()
    expect(container.querySelectorAll('[data-agent-tab-id]')).toHaveLength(1)
    const child = parent.parentElement!.nextElementSibling!.querySelector<HTMLButtonElement>(
      'button:has([aria-label="Blocked"])'
    )!
    expect(child.textContent).toBe('Review routing3m')
    await act(async () => child.click())
    expect(activate).toHaveBeenCalledWith('parent', paneKey)

    await act(async () => disclosure.click())
    expect(container.textContent).not.toContain('Review routing')
  } finally {
    await act(async () => root.unmount())
  }
})
