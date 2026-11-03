// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManagedPane, PaneManager } from '@/lib/pane-manager/pane-manager'
import { FOCUS_TERMINAL_PANE_EVENT, type FocusTerminalPaneDetail } from '@/constants/terminal'
import { handleFocusTerminalPaneDetail } from './focus-terminal-pane-event'
import { dispatchTerminalShortcutAction } from './terminal-keyboard-action-dispatch'

const setActiveTab = vi.hoisted(() => vi.fn())
vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({
      setActiveTab,
      setActiveTabType: vi.fn(),
      activeWorktreeId: 'wt-1',
      tabsByWorktree: { 'wt-1': [{ id: 'tab-0' }, { id: 'tab-1' }, { id: 'tab-2' }] }
    })
  }
}))
vi.mock('./terminal-selection-copy', () => ({ copyTerminalSelection: vi.fn() }))
vi.mock('./terminal-pane-split-with-inherited-cwd', () => ({
  splitTerminalPaneWithInheritedCwd: vi.fn()
}))
vi.mock('./terminal-pane-layout-owner-commands', () => ({ equalizeTerminalPanes: vi.fn() }))
vi.mock('@/lib/pane-manager/terminal-scroll-intent', () => ({
  markTerminalFollowOutput: vi.fn(),
  markTerminalPinnedViewport: vi.fn(),
  syncTerminalScrollIntentFromViewport: vi.fn()
}))

type PaneRectangle = [id: number, x: number, y: number, width: number, height: number]
const cleanup: (() => void)[] = []
let frames: Map<number, FrameRequestCallback>

beforeEach(() => {
  frames = new Map()
  let frameId = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
})

afterEach(() => {
  for (const dispose of cleanup.splice(0)) {
    dispose()
  }
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// RA: Real pane focus events cross tab owners; numeric pane IDs deliberately repeat between managers.
function prepare(rectanglesByTab: PaneRectangle[][]) {
  const groups = rectanglesByTab.map((rectangles, index) => {
    const tabId = `tab-${index}`
    const tab = document.createElement('div')
    tab.dataset.terminalTabId = tabId
    document.body.appendChild(tab)
    const panes = rectangles.map(([id, x, y, width, height]) => {
      const container = document.createElement('div')
      container.className = 'pane'
      container.id = `${tabId}-leaf-${id}`
      container.dataset.leafId = `0000000${index}-0000-4000-8000-${String(id).padStart(12, '0')}`
      const input = document.createElement('textarea')
      input.className = 'xterm-helper-textarea'
      container.appendChild(input)
      tab.appendChild(container)
      vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, width, height))
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Only geometry, identity and terminal focus are used here.
      return {
        id,
        leafId: container.dataset.leafId,
        container,
        terminal: { focus: () => input.focus() }
      } as unknown as ManagedPane
    })
    let active = panes[0]
    const manager = {
      getPanes: () => panes,
      getActivePane: () => active,
      getNumericIdForLeaf: (leafId: string) =>
        panes.find((pane) => pane.leafId === leafId)?.id ?? null,
      setActivePane: (id: number, opts?: { focus?: boolean }) => {
        active = panes.find((pane) => pane.id === id)!
        if (opts?.focus !== false) {
          active.terminal.focus()
        }
      }
    }
    const onFocus = (event: Event) => {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: This listener only receives the typed terminal focus event.
      handleFocusTerminalPaneDetail((event as CustomEvent<FocusTerminalPaneDetail>).detail, {
        tabId,
        manager,
        acknowledgeAgents: vi.fn(),
        surfaceStaleAgentRow: vi.fn()
      })
    }
    window.addEventListener(FOCUS_TERMINAL_PANE_EVENT, onFocus)
    cleanup.push(() => window.removeEventListener(FOCUS_TERMINAL_PANE_EVENT, onFocus))
    return { tab, panes, manager }
  })
  groups[0].manager.setActivePane(groups[0].panes[0].id)
  const expandedPaneIdRef: { current: number | null } = { current: null }
  const context = {
    expandedPaneIdRef,
    setExpandedPane: vi.fn(),
    restoreExpandedLayout: vi.fn(),
    refreshPaneSizes: vi.fn(),
    persistLayoutSnapshot: vi.fn()
  }
  const dispatch = (
    direction: 'left' | 'right' | 'up' | 'down',
    groupIndex = 0,
    repeat = false
  ): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { cancelable: true, repeat })
    dispatchTerminalShortcutAction(
      { type: 'focusPane', direction },
      event,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The fixture provides every manager operation used by focus dispatch.
      groups[groupIndex].manager as unknown as PaneManager,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Other context fields belong to actions this fixture never dispatches.
      context as unknown as Parameters<typeof dispatchTerminalShortcutAction>[3]
    )
    const pending = [...frames.values()]
    frames.clear()
    for (const callback of pending) {
      callback(0)
    }
    return event
  }
  const focusedLeaf = () => document.activeElement?.parentElement?.id
  return { groups, context, dispatch, focusedLeaf }
}

describe('directional terminal pane focus', () => {
  it('crosses two single-pane tab groups in both directions', () => {
    const p = prepare([
      [[1, 0, 0, 100, 100]],
      [[1, 100, 0, 100, 100]]
    ])
    expect(p.dispatch('right').defaultPrevented).toBe(true)
    expect(setActiveTab).toHaveBeenLastCalledWith('tab-1')
    expect(p.focusedLeaf()).toBe('tab-1-leaf-1')
    p.dispatch('left', 1)
    expect(setActiveTab).toHaveBeenLastCalledWith('tab-0')
    expect(p.focusedLeaf()).toBe('tab-0-leaf-1')
  })

  it.each([
    ['up', 'tab-1-leaf-1'],
    ['down', 'tab-2-leaf-1']
  ] as const)('crosses vertically stacked groups %s', (direction, expectedLeaf) => {
    const p = prepare([
      [[1, 0, 100, 100, 100]],
      [[1, 0, 0, 100, 100]],
      [[1, 0, 200, 100, 100]]
    ])
    p.dispatch(direction)
    expect(p.focusedLeaf()).toBe(expectedLeaf)
  })

  it.each([
    ['right', 2],
    ['down', 3],
    ['left', 1],
    ['up', 1]
  ] as const)('navigates a 2x2 split %s without choosing a diagonal', (direction, expectedId) => {
    const p = prepare([
      [
        [1, 0, 0, 100, 100],
        [4, 100, 100, 100, 100],
        [2, 100, 0, 100, 100],
        [3, 0, 100, 100, 100]
      ]
    ])
    if (direction === 'left') {
      p.groups[0].manager.setActivePane(2)
    }
    if (direction === 'up') {
      p.groups[0].manager.setActivePane(3)
    }
    p.dispatch(direction)
    expect(p.focusedLeaf()).toBe(`tab-0-leaf-${expectedId}`)
  })

  it('navigates a split inside one group and then across groups', () => {
    const p = prepare([
      [
        [1, 0, 0, 100, 100],
        [2, 100, 0, 100, 100]
      ],
      [
        [1, 200, 0, 100, 100],
        [2, 200, 100, 100, 100]
      ]
    ])
    p.dispatch('right')
    expect(p.focusedLeaf()).toBe('tab-0-leaf-2')
    p.dispatch('right')
    expect(p.focusedLeaf()).toBe('tab-1-leaf-1')
    p.dispatch('down', 1)
    expect(p.focusedLeaf()).toBe('tab-1-leaf-2')
  })

  it('prefers perpendicular overlap, then the nearest center, regardless of insertion order', () => {
    const p = prepare([
      [
        [1, 0, 0, 100, 100],
        [2, 100, 101, 100, 100],
        [3, 400, 0, 100, 100],
        [4, 300, 0, 100, 100]
      ]
    ])
    p.dispatch('right')
    expect(p.focusedLeaf()).toBe('tab-0-leaf-4')
  })

  it('falls back to the nearest diagonal when no pane overlaps', () => {
    const p = prepare([
      [[1, 0, 0, 100, 100]],
      [[1, 100, 150, 100, 100]]
    ])
    p.dispatch('right')
    expect(p.focusedLeaf()).toBe('tab-1-leaf-1')
  })

  it.each(['display', 'visibility', 'opacity', 'chat', 'zero-size'])(
    'excludes a closer hidden terminal (%s)',
    (hidden) => {
      const p = prepare([
        [[1, 0, 0, 100, 100]],
        [[1, 100, 0, 100, 100]],
        [[1, 200, 0, 100, 100]]
      ])
      const group = p.groups[1]
      if (hidden === 'display') {
        group.tab.style.display = 'none'
      }
      if (hidden === 'visibility') {
        group.tab.style.visibility = 'hidden'
      }
      if (hidden === 'opacity') {
        group.tab.style.opacity = '0'
      }
      if (hidden === 'chat') {
        const cover = document.createElement('div')
        cover.className = 'native-chat-pane-shell'
        group.panes[0].container.appendChild(cover)
      }
      if (hidden === 'zero-size') {
        vi.mocked(group.panes[0].container.getBoundingClientRect).mockReturnValue(new DOMRect())
      }
      p.dispatch('right')
      expect(p.focusedLeaf()).toBe('tab-2-leaf-1')
    }
  )

  it('consumes edge and repeat chords without wrapping or moving focus', () => {
    const p = prepare([
      [[1, 0, 0, 100, 100]],
      [[1, 100, 0, 100, 100]]
    ])
    expect(p.dispatch('left').defaultPrevented).toBe(true)
    expect(p.dispatch('right', 0, true).defaultPrevented).toBe(true)
    expect(p.focusedLeaf()).toBe('tab-0-leaf-1')
    expect(setActiveTab).not.toHaveBeenCalled()
  })

  it('keeps expanded siblings hidden while navigating to another visible group', () => {
    const p = prepare([
      [
        [1, 0, 0, 100, 100],
        [2, 100, 0, 0, 0]
      ],
      [[1, 200, 0, 100, 100]]
    ])
    p.context.expandedPaneIdRef.current = 1
    p.dispatch('right')
    expect(p.focusedLeaf()).toBe('tab-1-leaf-1')
    expect(p.context.restoreExpandedLayout).not.toHaveBeenCalled()
  })
})
