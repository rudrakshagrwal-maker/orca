import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveTerminalShortcutAction, type TerminalShortcutEvent } from './input/keyboard/terminal-shortcut-policy'
import { setRightCtrlHeldForTest } from './right-ctrl-held'

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
  beforeEach(() => setRightCtrlHeldForTest(true))
  afterEach(() => setRightCtrlHeldForTest(false))

  it.each([
    ['ArrowLeft', 'left'],
    ['ArrowRight', 'right'],
    ['ArrowUp', 'up'],
    ['ArrowDown', 'down']
  ] as const)('focuses the %s pane before Windows byte fallbacks', (key, direction) => {
    const isLocalWindowsConptyPane = vi.fn(() => true)
    // RA: Agent keyboard protocols and terminal-first must not route navigation into the PTY.
    const getKittyKeyboardFlags = vi.fn(() => 31)
    for (const terminalShortcutPolicy of ['orca-first', 'terminal-first'] as const) {
      for (const repeat of [false, true]) {
        expect(
          resolveTerminalShortcutAction(
            event({ key, code: key, ctrlKey: true, repeat }),
            false,
            'false',
            0,
            true,
            undefined,
            isLocalWindowsConptyPane,
            getKittyKeyboardFlags,
            undefined,
            undefined,
            () => true,
            terminalShortcutPolicy
          )
        ).toEqual({ type: 'focusPane', direction })
      }
    }
    expect(isLocalWindowsConptyPane).not.toHaveBeenCalled()
    expect(getKittyKeyboardFlags).not.toHaveBeenCalled()
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

  // RA: Left Ctrl+Arrow keeps word-jump; only Right Ctrl moves panes.
  it('leaves Left Ctrl+Arrow to word-jump on Windows and Linux', () => {
    setRightCtrlHeldForTest(false)
    const arrow = event({ key: 'ArrowLeft', code: 'ArrowLeft', ctrlKey: true })
    expect(resolveTerminalShortcutAction(arrow, false, 'false', 0, true, undefined, () => true)).toBeNull()
    expect(resolveTerminalShortcutAction(arrow, false)).toEqual({ type: 'sendInput', data: '\x1bb' })
  })
})
