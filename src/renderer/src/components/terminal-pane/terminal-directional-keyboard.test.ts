// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setRightCtrlHeldForTest } from './right-ctrl-held'
import { createTerminalKeyboardEventHandlers } from './input/keyboard/terminal-keyboard-event-handlers'
import { resolveTerminalShortcutAction, type TerminalShortcutEvent } from './input/keyboard/terminal-shortcut-policy'
import { focusTerminalPaneInDirection } from './terminal-directional-focus'

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock('./terminal-directional-focus', () => ({ focusTerminalPaneInDirection: vi.fn() }))

const cleanup: (() => void)[] = []
// RA: the fork reserves Left Ctrl for word navigation; this suite exercises Right Ctrl.
beforeEach(() => setRightCtrlHeldForTest(true))

afterEach(() => {
  setRightCtrlHeldForTest(false)
  for (const dispose of cleanup.splice(0)) {
    dispose()
  }
  document.body.replaceChildren()
  vi.clearAllMocks()
})

// RA: Window capture must consume agent navigation before the target's xterm/PTY handler.
function prepare() {
  const scope = document.createElement('div')
  const helper = document.createElement('textarea')
  helper.className = 'xterm-helper-textarea'
  const search = document.createElement('input')
  const editor = document.createElement('div')
  editor.contentEditable = 'true'
  editor.tabIndex = 0
  scope.append(helper, search, editor)
  document.body.appendChild(scope)
  const pane = { id: 1, terminal: { element: scope } }
  const manager = { getActivePane: () => pane, getPanes: () => [pane] }
  const sendInput = vi.fn()
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Only keydown is exercised; unused release and non-navigation dependencies are omitted.
  const handlers = createTerminalKeyboardEventHandlers({
    isMac: false,
    isWindows: true,
    shortcutPlatform: 'win32',
    keyboardScopeRef: { current: scope },
    managerRef: { current: manager },
    nativeOnlyShortcutTracker: { prepareKeyDown: vi.fn() },
    getModifiedEnterChord: () => null,
    searchOpenRef: { current: false },
    searchStateRef: { current: { query: '', caseSensitive: false, regex: false } },
    terminalShortcutPolicy: 'terminal-first',
    resolveShortcutEvent: (event: TerminalShortcutEvent) =>
      resolveTerminalShortcutAction(
        event,
        false,
        'false',
        0,
        true,
        undefined,
        () => true,
        () => 31,
        undefined,
        undefined,
        () => true,
        'terminal-first'
      ),
    createCapturedInputSender: () => sendInput
  } as never)
  window.addEventListener('keydown', handlers.onKeyDown, { capture: true })
  cleanup.push(() => window.removeEventListener('keydown', handlers.onKeyDown, { capture: true }))
  const press = (target: HTMLElement, key = 'ArrowRight', repeat = false) => {
    target.focus()
    const event = new KeyboardEvent('keydown', {
      key,
      code: key,
      ctrlKey: true,
      repeat,
      bubbles: true,
      cancelable: true
    })
    target.dispatchEvent(event)
    return event
  }
  return { helper, search, editor, manager, sendInput, press }
}

describe('directional terminal keyboard capture', () => {
  it.each([
    ['ArrowLeft', 'left'],
    ['ArrowRight', 'right'],
    ['ArrowUp', 'up'],
    ['ArrowDown', 'down']
  ] as const)('consumes Windows agent %s before xterm can forward it', (key, direction) => {
    const p = prepare()
    const xtermKeyHandler = vi.fn()
    p.helper.addEventListener('keydown', xtermKeyHandler)
    expect(p.press(p.helper, key).defaultPrevented).toBe(true)
    expect(focusTerminalPaneInDirection).toHaveBeenCalledExactlyOnceWith(p.manager, direction)
    expect(p.press(p.helper, key, true).defaultPrevented).toBe(true)
    expect(focusTerminalPaneInDirection).toHaveBeenCalledTimes(1)
    expect(xtermKeyHandler).not.toHaveBeenCalled()
    expect(p.sendInput).not.toHaveBeenCalled()
  })

  it.each(['search', 'editor', 'outside'] as const)(
    'preserves word navigation in %s',
    (surface) => {
      const p = prepare()
      const outside = document.createElement('input')
      document.body.appendChild(outside)
      const target = surface === 'outside' ? outside : p[surface]
      const targetKeyHandler = vi.fn()
      target.addEventListener('keydown', targetKeyHandler)
      expect(p.press(target).defaultPrevented).toBe(false)
      expect(document.activeElement).toBe(target)
      expect(targetKeyHandler).toHaveBeenCalledOnce()
      expect(focusTerminalPaneInDirection).not.toHaveBeenCalled()
      expect(p.sendInput).not.toHaveBeenCalled()
    }
  )
})
