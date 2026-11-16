import { describe, expect, it } from 'vitest'
import {
  KEYBINDING_DEFINITIONS,
  keybindingMatchesAction,
  type KeybindingActionId,
  type KeybindingMatchOptions,
  type KeybindingOverrides
} from './keybindings'

function owners(
  key: string,
  shift: boolean,
  options: KeybindingMatchOptions,
  platform: NodeJS.Platform = 'win32',
  overrides?: KeybindingOverrides
): KeybindingActionId[] {
  return KEYBINDING_DEFINITIONS.filter((definition) =>
    keybindingMatchesAction(
      definition.id,
      { key, control: true, shift },
      platform,
      overrides,
      options
    )
  ).map((definition) => definition.id)
}

describe('terminal Control shortcuts', () => {
  it('leaves agent Control chords unclaimed, even with saved overrides', () => {
    const terminal = { context: 'terminal' } as const
    const overrides: KeybindingOverrides = {
      'worktree.quickOpen': ['Ctrl+O'],
      'terminal.clear': ['Ctrl+R']
    }
    for (const key of ['b', 't', 'o', 'r']) {
      expect(owners(key, false, terminal, 'win32', overrides)).toEqual([])
      expect(owners(key, false, terminal, 'linux', overrides)).toEqual([])
      expect(owners(key, false, terminal, 'darwin', overrides)).toEqual([])
    }
  })

  it('routes shifted terminal chords to one owner under either priority policy', () => {
    for (const terminalShortcutPolicy of ['orca-first', 'terminal-first'] as const) {
      const terminal = { context: 'terminal', terminalShortcutPolicy } as const
      expect(owners('b', true, terminal)).toEqual(['sidebar.left.toggle'])
      expect(owners('t', true, terminal)).toEqual(['tab.newTerminal'])
      expect(owners('o', true, terminal)).toEqual(['tab.openMarkdown'])
      expect(owners('r', true, terminal)).toEqual(['app.forceReload'])
      expect(owners('b', true, terminal, 'linux')).toEqual(['sidebar.left.toggle'])
      expect(owners('t', true, terminal, 'linux')).toEqual(['tab.newTerminal'])
      expect(owners('b', true, terminal, 'darwin')).toEqual(['sidebar.left.toggle'])
      expect(owners('t', true, terminal, 'darwin')).toEqual(['tab.newTerminal'])
      expect(owners('o', true, terminal, 'darwin')).toEqual(['tab.openMarkdown'])
      expect(owners('r', true, terminal, 'darwin')).toEqual(['app.forceReload'])
    }
  })

  it('preserves app shortcuts outside terminals and Command shortcuts on macOS', () => {
    const app = { context: 'app' } as const
    expect(owners('b', false, app)).toEqual(['sidebar.left.toggle'])
    expect(owners('t', false, app)).toEqual(['tab.newTerminal'])
    expect(owners('o', false, app)).toEqual([])
    expect(owners('r', false, app)).toEqual(['browser.reload'])
    expect(owners('b', true, app)).toEqual(['tab.newBrowser'])
    expect(owners('t', true, app)).toEqual(['tab.reopenClosed'])
    expect(
      keybindingMatchesAction(
        'sidebar.left.toggle',
        { key: 'b', meta: true },
        'darwin',
        undefined,
        { context: 'terminal' }
      )
    ).toBe(true)
  })

  it('keeps disabled actions disabled and honors unrelated remaps', () => {
    const terminal = { context: 'terminal' } as const
    expect(owners('t', true, terminal, 'win32', { 'tab.newTerminal': [] })).toEqual([])
    expect(
      keybindingMatchesAction(
        'tab.newTerminal',
        { key: 'y', control: true },
        'win32',
        { 'tab.newTerminal': ['Ctrl+Y'] },
        terminal
      )
    ).toBe(true)
  })
})
