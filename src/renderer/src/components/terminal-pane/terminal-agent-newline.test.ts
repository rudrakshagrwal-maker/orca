// RA: Claude/Codex Shift+Enter stays a newline chord across host keyboard modes.
import { describe, expect, it } from 'vitest'
import {
  resolveTerminalShortcutAction,
  type TerminalShortcutEvent
} from './input/keyboard/terminal-shortcut-policy'
import { resolveWindowsShiftEnterEncoding } from './input/keyboard/terminal-windows-shift-enter'

const chord: TerminalShortcutEvent = {
  key: 'Enter',
  code: 'Enter',
  shiftKey: true,
  ctrlKey: false,
  metaKey: false,
  altKey: false
}

describe('agent terminal newline', () => {
  it.each(['claude', 'codex'] as const)('keeps %s Shift+Enter distinct from submit', (agent) => {
    const encoding = resolveWindowsShiftEnterEncoding({
      foreground: { agent, routingTrusted: true, shellForeground: false }
    })
    for (const platform of ['win32', 'linux', 'darwin'] as const) {
      for (const kittyFlags of [0, 1]) {
        const action = resolveTerminalShortcutAction(
          chord,
          platform === 'darwin',
          'false',
          0,
          platform === 'win32',
          undefined,
          undefined,
          () => kittyFlags,
          undefined,
          () => encoding
        )
        expect(action).toEqual({
          type: 'sendInput',
          data: kittyFlags > 0 ? '\x1b[13;2u' : '\x1b\r'
        })
        expect(action).not.toEqual({ type: 'sendInput', data: '\r' })
      }
    }
  })
})
