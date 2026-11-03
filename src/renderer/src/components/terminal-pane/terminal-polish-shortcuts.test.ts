import { describe, expect, it } from 'vitest'
import { resolveTerminalShortcutAction, type TerminalShortcutEvent } from './terminal-shortcut-policy'
import { resolveWindowsShiftEnterEncoding } from './terminal-windows-shift-enter'

// RA: verify the existing pane zoom and modified-enter path under both shortcut priorities.
const enter: TerminalShortcutEvent = {
  key: 'Enter', code: 'Enter', metaKey: false, ctrlKey: false, altKey: false, shiftKey: true
}

describe.each(['darwin', 'win32', 'linux'] as const)('pane shortcuts on %s', (platform) => {
  it.each(['orca-first', 'terminal-first'] as const)('toggles pane zoom under %s and leaves Escape for TUIs', (policy) => {
    const resolve = (event: TerminalShortcutEvent) => resolveTerminalShortcutAction(
      event, platform === 'darwin', 'false', 0, platform === 'win32', undefined,
      undefined, undefined, undefined, undefined, undefined, policy
    )
    expect(resolve({ ...enter, metaKey: platform === 'darwin', ctrlKey: platform !== 'darwin' }))
      .toEqual({ type: 'toggleExpandActivePane' })
    expect(resolve({ ...enter, key: 'Escape', code: 'Escape', shiftKey: false })).toBeNull()
  })

  it.each(['claude', 'codex'] as const)('encodes a %s newline without a bare submit', (agent) => {
    const encoding = resolveWindowsShiftEnterEncoding({ foreground: {
      agent, routingTrusted: true, shellForeground: false
    } })
    for (const flags of [0, 1]) {
      const result = resolveTerminalShortcutAction(
        enter, platform === 'darwin', 'false', 0, platform === 'win32', undefined,
        undefined, () => flags, undefined, () => encoding, () => platform === 'win32'
      )
      expect(result).toEqual({ type: 'sendInput', data: flags ? '\x1b[13;2u' : '\x1b\r' })
    }
  })
})
