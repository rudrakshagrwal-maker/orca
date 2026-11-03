// @vitest-environment happy-dom
// RA: Exercise the existing remappable zoom chord and split restoration.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import { createExpandCollapseActions } from './expand-collapse'
import {
  resolveTerminalShortcutAction,
  type TerminalShortcutEvent
} from './terminal-shortcut-policy'

const chord: TerminalShortcutEvent = {
  key: 'Enter',
  code: 'Enter',
  ctrlKey: true,
  shiftKey: true,
  metaKey: false,
  altKey: false
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pane zoom', () => {
  it('uses Ctrl+Shift+Enter on Windows/Linux and preserves remapping and Escape', () => {
    for (const windows of [true, false]) {
      expect(resolveTerminalShortcutAction(chord, false, 'false', 0, windows)).toEqual({
        type: 'toggleExpandActivePane'
      })
    }
    const overrides = { 'terminal.expandPane': ['Ctrl+Shift+Z'] }
    expect(resolveTerminalShortcutAction(chord, false, 'false', 0, true, overrides)).toBeNull()
    expect(
      resolveTerminalShortcutAction(
        { ...chord, key: 'Z', code: 'KeyZ' },
        false,
        'false',
        0,
        true,
        overrides
      )
    ).toEqual({ type: 'toggleExpandActivePane' })
    expect(
      resolveTerminalShortcutAction(
        { ...chord, key: 'Escape', code: 'Escape', ctrlKey: false, shiftKey: false },
        false
      )
    ).toBeNull()
  })

  it('fills only its tab container and restores the original split on the second toggle', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    const root = document.createElement('div')
    const first = document.createElement('div')
    const second = document.createElement('div')
    first.style.flex = '2 1 0%'
    second.style.flex = '1 1 0%'
    second.style.display = 'flex'
    root.append(first, second)
    const initialFirstFlex = first.style.flex
    const initialSecondFlex = second.style.flex
    const panes = [
      { id: 1, container: first },
      { id: 2, container: second }
    ]
    const expanded = { current: null as number | null }
    const state: Parameters<typeof createExpandCollapseActions>[0] = {
      expandedPaneIdRef: expanded,
      expandedStyleSnapshotRef: { current: new Map() },
      containerRef: { current: root },
      managerRef: {
        current: {
          getPanes: () => panes,
          setActivePane: vi.fn()
        } as unknown as PaneManager
      },
      pendingPaneSizeRefreshFrameIdsRef: { current: [] },
      setExpandedPaneId: vi.fn(),
      setTabPaneExpanded: vi.fn(),
      tabId: 'tab',
      persistLayoutSnapshot: vi.fn()
    }
    const actions = createExpandCollapseActions(state)
    actions.toggleExpandPane(1)
    expect(expanded.current).toBe(1)
    expect(second.style.display).toBe('none')
    expect(first.style.flex).toBe('1 1 auto')
    actions.toggleExpandPane(1)
    expect(expanded.current).toBeNull()
    expect(first.style.flex).toBe(initialFirstFlex)
    expect(second.style.flex).toBe(initialSecondFlex)
    expect(second.style.display).toBe('flex')
    expect(state.expandedStyleSnapshotRef.current.size).toBe(0)
  })
})
