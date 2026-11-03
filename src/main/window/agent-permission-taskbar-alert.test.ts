import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { createAgentPermissionTaskbarAlert } from './agent-permission-taskbar-alert'

// RA: exercise permission edges without opening or focusing a native window.
function fixture(platform: NodeJS.Platform = 'win32') {
  let focused = false
  const window = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    isFocused: () => focused,
    flashFrame: vi.fn()
  })
  const alert = createAgentPermissionTaskbarAlert(window as Parameters<typeof createAgentPermissionTaskbarAlert>[0], platform)
  return { window, alert, focus: () => { focused = true; window.emit('focus') } }
}

const permission = { state: 'blocked', kind: 'permission', observedAt: 1 } as const

describe('silent taskbar permission alerts', () => {
  it('flashes once per permission transition and stops on focus', () => {
    const { window, alert, focus } = fixture()
    alert.observe('pane', permission)
    alert.observe('pane', { ...permission, observedAt: 2 })
    expect(window.flashFrame.mock.calls).toEqual([[true]])
    focus()
    expect(window.flashFrame.mock.calls).toEqual([[true], [false]])
    alert.observe('pane', { state: 'working', observedAt: 3 })
    alert.observe('pane', permission)
    expect(window.flashFrame).toHaveBeenCalledTimes(2)
    alert.dispose()
    expect(window.listenerCount('focus')).toBe(0)
  })

  it('rearms after clearing a pane without flashing replayed permissions', () => {
    const { window, alert } = fixture()
    alert.observe('pane', permission, true)
    alert.observe('pane', permission)
    expect(window.flashFrame).not.toHaveBeenCalled()
    alert.clear('pane')
    alert.observe('pane', permission)
    expect(window.flashFrame.mock.calls).toEqual([[true]])
  })

  it.each(['darwin', 'linux'] as const)('does not request a native flash on %s', (platform) => {
    const { window, alert, focus } = fixture(platform)
    alert.observe('pane', permission)
    focus()
    alert.dispose()
    expect(window.flashFrame).not.toHaveBeenCalled()
  })

  it('ignores questions, auth blocks and destroyed windows', () => {
    const { window, alert } = fixture()
    alert.observe('question', { ...permission, kind: 'question' })
    alert.observe('auth', { ...permission, kind: 'auth' })
    window.isDestroyed = () => true
    alert.observe('permission', permission)
    alert.dispose()
    expect(window.flashFrame).not.toHaveBeenCalled()
  })
})
