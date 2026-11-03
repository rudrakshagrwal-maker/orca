// RA: Verify local attention delivery and retirement without native windows.
import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { AgentHookServer, EnrichedAgentHookEventPayload } from '../agent-hooks/server'
import type { AgentStatusClearIpcPayload } from '../../shared/agent-status-types'
import { installAgentTaskbarAttention } from './agent-taskbar-attention'

function setup(platform: NodeJS.Platform = 'win32') {
  const events = new EventEmitter()
  const window = Object.assign(events, {
    isDestroyed: vi.fn(() => false),
    isFocused: vi.fn(() => false),
    flashFrame: vi.fn<(flag: boolean) => void>()
  })
  const listeners = new Set<(event: EnrichedAgentHookEventPayload) => void>()
  const clearListeners = new Set<(event: AgentStatusClearIpcPayload) => void>()
  const statuses: Pick<AgentHookServer, 'subscribeEnrichedStatus' | 'subscribePaneStatusClear'> = {
    subscribeEnrichedStatus: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    subscribePaneStatusClear: (listener) => {
      clearListeners.add(listener)
      return () => {
        clearListeners.delete(listener)
      }
    }
  }
  const dispose = installAgentTaskbarAttention(
    window as unknown as Parameters<typeof installAgentTaskbarAttention>[0],
    statuses,
    platform
  )
  const publish = (overrides: Partial<EnrichedAgentHookEventPayload> = {}): void => {
    const event: EnrichedAgentHookEventPayload = {
      paneKey: 'tab:pane',
      connectionId: null,
      receivedAt: 1,
      stateStartedAt: 1,
      payload: { state: 'waiting', prompt: '', agentType: 'claude' },
      programStatus: { state: 'blocked', kind: 'permission', observedAt: 1 },
      ...overrides
    }
    for (const listener of listeners) {
      listener(event)
    }
  }
  const clear = (event: AgentStatusClearIpcPayload): void => {
    for (const listener of clearListeners) {
      listener(event)
    }
  }
  return { window, publish, clear, dispose, listeners, clearListeners }
}

describe('agent taskbar attention', () => {
  it('flashes once per permission edge, stops on focus, and rearms on the next prompt', () => {
    const { window, publish, dispose } = setup()
    publish()
    publish({ programStatusOnly: true })
    expect(window.flashFrame.mock.calls).toEqual([[true]])
    window.isFocused.mockReturnValue(true)
    window.emit('focus')
    publish()
    expect(window.flashFrame.mock.calls).toEqual([[true], [false]])
    publish({ programStatus: { state: 'working', observedAt: 2 } })
    window.isFocused.mockReturnValue(false)
    publish()
    expect(window.flashFrame.mock.calls).toEqual([[true], [false], [true]])
    dispose()
    window.flashFrame.mockClear()
    publish()
    window.emit('focus')
    expect(window.flashFrame).not.toHaveBeenCalled()
  })

  it('ignores focused windows, hook-only states, replay, and non-permission OSC blocks', () => {
    const { window, publish, dispose } = setup()
    publish({ isReplay: true })
    publish({ restoredUnconfirmed: true })
    publish({ programStatus: undefined })
    publish({ programStatus: { state: 'blocked', kind: 'auth', observedAt: 2 } })
    window.isFocused.mockReturnValue(true)
    publish()
    expect(window.flashFrame).not.toHaveBeenCalled()
    dispose()
  })

  it('forgets pane and SSH-disconnect state and avoids destroyed windows', () => {
    const { window, publish, clear, dispose } = setup()
    publish({ connectionId: 'ssh:1' })
    clear({ transient: true, connectionId: 'ssh:1', clearedAt: 2 })
    publish({ connectionId: 'ssh:1' })
    clear({ paneKey: 'tab:pane' })
    publish()
    expect(window.flashFrame.mock.calls).toEqual([[true], [true], [true]])
    window.isDestroyed.mockReturnValue(true)
    window.emit('focus')
    publish({ paneKey: 'tab:other' })
    dispose()
    expect(window.flashFrame.mock.calls).toEqual([[true], [true], [true]])
  })

  it.each(['darwin', 'linux'] as const)('does not install Windows attention on %s', (platform) => {
    const { window, publish, dispose, listeners, clearListeners } = setup(platform)
    publish()
    window.emit('focus')
    dispose()
    expect(listeners.size + clearListeners.size).toBe(0)
    expect(window.flashFrame).not.toHaveBeenCalled()
  })
})
