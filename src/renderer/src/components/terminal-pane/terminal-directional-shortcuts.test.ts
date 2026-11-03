import { describe, expect, it, vi } from 'vitest'
import { resolveTerminalShortcutAction, type TerminalShortcutEvent } from './terminal-shortcut-policy'

function event(overrides: Partial<TerminalShortcutEvent>): TerminalShortcutEvent {
  return {
    key: '',
    code: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    ...overrides
  }
}

// RA: Pane navigation wins over ConPTY/readline word jumps for local, remote and repeated input.
describe('directional pane shortcuts', () => {
  it.each([
    ['ArrowLeft', 'left'],
    ['ArrowRight', 'right'],
    ['ArrowUp', 'up'],
    ['ArrowDown', 'down']
  ] as const)('focuses the %s pane before Windows byte fallbacks', (key, direction) => {
    const isLocalWindowsConptyPane = vi.fn(() => true)
    for (const repeat of [false, true]) {
      expect(
        resolveTerminalShortcutAction(
          event({ key, code: key, ctrlKey: true, repeat }),
          false,
          'false',
          0,
          true,
          undefined,
          isLocalWindowsConptyPane
        )
      ).toEqual({ type: 'focusPane', direction })
    }
    expect(isLocalWindowsConptyPane).not.toHaveBeenCalled()
    expect(
      resolveTerminalShortcutAction(event({ key, code: key, ctrlKey: true }), false)
    ).toEqual({ type: 'focusPane', direction })
    expect(
      resolveTerminalShortcutAction(event({ key, code: key, ctrlKey: true }), true)
    ).toEqual({ type: 'focusPane', direction })
  })

  it('honors disabled and remapped directional pane shortcuts', () => {
    expect(
      resolveTerminalShortcutAction(
        event({ key: 'ArrowLeft', code: 'ArrowLeft', ctrlKey: true }),
        false,
        'false',
        0,
        true,
        { 'terminal.focusPaneLeft': [] },
        () => true
      )
    ).toBeNull()
    expect(
      resolveTerminalShortcutAction(
        event({ key: 'h', code: 'KeyH', ctrlKey: true, shiftKey: true }),
        false,
        'false',
        0,
        true,
        { 'terminal.focusPaneLeft': ['Ctrl+Shift+H'] }
      )
    ).toEqual({ type: 'focusPane', direction: 'left' })
  })
})
