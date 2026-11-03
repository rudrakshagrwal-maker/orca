// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import type { ManagedPane, PaneManager } from '@/lib/pane-manager/pane-manager'
import { dispatchTerminalShortcutAction } from './terminal-keyboard-action-dispatch'

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

// RA: Exercise spatial dispatch against measured pane geometry, independent of pane insertion order.
function prepare() {
  const rectangles = [
    [1, 100, 100, 100, 100],
    [2, 400, 100, 100, 100],
    [3, 200, 100, 100, 100],
    [4, 0, 100, 100, 100],
    [5, 100, 0, 100, 100],
    [6, 100, 200, 100, 100],
    [7, 175, 100, 0, 0]
  ]
  const panes = rectangles.map(([id, x, y, width, height]) => {
    const container = document.createElement('div')
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, width, height))
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Focus dispatch reads only id and container.
    return { id, container } as ManagedPane
  })
  let active = panes[0]
  const manager = {
    getPanes: () => panes,
    getActivePane: () => active,
    setActivePane: (id: number) => {
      active = panes.find((pane) => pane.id === id)!
    }
  }
  const expandedPaneIdRef: { current: number | null } = { current: null }
  const context = {
    expandedPaneIdRef,
    setExpandedPane: vi.fn(),
    restoreExpandedLayout: vi.fn(),
    refreshPaneSizes: vi.fn(),
    persistLayoutSnapshot: vi.fn()
  }
  const dispatch = (direction: 'left' | 'right' | 'up' | 'down', repeat = false): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { cancelable: true, repeat })
    dispatchTerminalShortcutAction(
      { type: 'focusPane', direction },
      event,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The fixture provides every manager operation used by focus dispatch.
      manager as unknown as PaneManager,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Other context fields belong to actions this fixture never dispatches.
      context as unknown as Parameters<typeof dispatchTerminalShortcutAction>[3]
    )
    return event
  }
  return { panes, manager, context, dispatch }
}

describe('directional terminal pane focus', () => {
  it.each([
    ['left', 4],
    ['right', 3],
    ['up', 5],
    ['down', 6]
  ] as const)('selects the nearest visible pane %s', (direction, expectedId) => {
    const p = prepare()
    expect(p.dispatch(direction).defaultPrevented).toBe(true)
    expect(p.manager.getActivePane().id).toBe(expectedId)
  })

  it('consumes an edge chord without wrapping or moving focus on repeat', () => {
    const p = prepare()
    p.manager.setActivePane(2)
    expect(p.dispatch('right').defaultPrevented).toBe(true)
    expect(p.manager.getActivePane().id).toBe(2)
    expect(p.dispatch('left', true).defaultPrevented).toBe(true)
    expect(p.manager.getActivePane().id).toBe(2)
  })

  it('consumes the chord in a single-pane tab', () => {
    const p = prepare()
    p.panes.splice(1)
    expect(p.dispatch('right').defaultPrevented).toBe(true)
    expect(p.manager.getActivePane().id).toBe(1)
  })

  it('restores an expanded layout before measuring its neighbouring panes', () => {
    const p = prepare()
    p.context.expandedPaneIdRef.current = 1
    p.context.restoreExpandedLayout.mockImplementation(() => {
      vi.mocked(p.panes[2].container.getBoundingClientRect).mockReturnValue(
        new DOMRect(500, 100, 100, 100)
      )
    })
    p.dispatch('right')
    expect(p.context.setExpandedPane).toHaveBeenCalledWith(null)
    expect(p.manager.getActivePane().id).toBe(2)
  })
})
