import { describe, expect, it } from 'vitest'
import {
  KEYBINDING_DEFINITIONS,
  getEffectiveKeybindingsForAction,
  keybindingMatchesAction
} from './keybindings'
import type { KeybindingActionId } from './keybindings'

// RA: Windows ships one chord per action, while removed aliases remain user-remappable.
describe('Windows default shortcuts', () => {
  it('has at most one default binding per action', () => {
    for (const definition of KEYBINDING_DEFINITIONS) {
      expect(definition.defaultBindings.win32.length, definition.id).toBeLessThanOrEqual(1)
    }
  })

  it.each([
    ['tab.newTerminal', ['Mod+T']],
    ['tab.close', ['Mod+W']],
    ['tab.reopenClosed', ['Mod+Shift+T']],
    ['tab.nextAllTypes', ['Ctrl+Tab']],
    ['tab.previousAllTypes', ['Ctrl+Shift+Tab']],
    ['tab.selectByIndex', ['Ctrl+1']],
    ['terminal.copySelection', ['Ctrl+C']],
    ['terminal.paste', ['Ctrl+V']],
    ['tab.nextTerminal', []],
    ['tab.previousTerminal', []],
    ['tab.nextSameType', []],
    ['tab.previousSameType', []],
    ['terminal.focusNextPane', []],
    ['terminal.focusPreviousPane', []]
  ] satisfies [KeybindingActionId, string[]][])(
    'keeps the Windows default for %s',
    (actionId, bindings) => {
      expect(getEffectiveKeybindingsForAction(actionId, 'win32')).toEqual(bindings)
    }
  )

  it('disables Shift+Insert by default but honors an explicit paste override', () => {
    const input = { key: 'Insert', control: false, meta: false, alt: false, shift: true }
    expect(keybindingMatchesAction('terminal.paste', input, 'win32')).toBe(false)
    expect(
      keybindingMatchesAction('terminal.paste', input, 'win32', {
        'terminal.paste': ['Shift+Insert']
      })
    ).toBe(true)
  })
})
