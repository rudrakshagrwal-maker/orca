import { describe, expect, it } from 'vitest'
import { PLUGIN_PANEL_FRAME_NAME_PREFIX } from '../../shared/plugins/frames/plugin-frame-bridge'
import { HostFrameNavigationRegistry } from './host-frame-navigation-guard'

function frame(input: { id: number; name?: string; url?: string }) {
  let destroyed = false
  return {
    frameTreeNodeId: input.id,
    name: input.name ?? '',
    isDestroyed: () => destroyed,
    destroy: () => {
      destroyed = true
    }
  }
}

describe('HostFrameNavigationRegistry', () => {



  it('does not inspect unrelated guarded frames during registration or navigation', () => {
    const registry = new HostFrameNavigationRegistry()
    let livenessChecks = 0
    const panels = Array.from({ length: 100 }, (_, id) => ({
      ...frame({ id, name: `${PLUGIN_PANEL_FRAME_NAME_PREFIX}${id}` }),
      isDestroyed: () => {
        livenessChecks++
        return false
      }
    }))
    for (const panel of panels) {
      registry.register(panel)
    }
    const ordinary = frame({ id: 101 })
    registry.register(ordinary)
    expect(registry.shouldBlock(ordinary, null, 'https://example.com')).toBe(false)
    expect(registry.shouldBlock(panels[0], null, 'about:srcdoc')).toBe(false)
    expect(registry.shouldBlock(panels[0], panels[0], 'https://example.com')).toBe(true)
    expect(registry.shouldBlock(ordinary, panels[1], 'https://example.com')).toBe(true)
    expect(livenessChecks).toBeLessThanOrEqual(4)
  })
})
