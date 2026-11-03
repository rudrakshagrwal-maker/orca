import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManagedPaneInternal } from './pane-manager-types'
import { resumePaneRendering, suspendPaneRendering } from './pane-rendering-control'
import {
  resetHiddenWebglRetentionForTest,
  retainedHiddenWebglOwnerCountForTest
} from './terminal-webgl-hidden-retention'

function createPane(): ManagedPaneInternal {
  return {
    terminal: { blur: vi.fn(), options: { cursorBlink: true } },
    webglAddon: { dispose: vi.fn() },
    webglAttachmentDeferred: false,
    webglDisabledAfterContextLoss: false,
    webglAttachFailedSinceRecovery: false,
    gpuRenderingEnabled: true,
    pendingWebglRefreshRafId: null
  } as unknown as ManagedPaneInternal
}

// RA: hidden terminals release GPU resources regardless of recent workspace/tab history.
describe('terminal-webgl-hidden-retention', () => {
  beforeEach(() => {
    resetHiddenWebglRetentionForTest()
  })

  it('disposes hidden contexts across successive workspaces without retaining owners', () => {
    for (let index = 0; index < 8; index += 1) {
      const panes = [createPane(), createPane()]
      const addons = panes.map((pane) => pane.webglAddon)
      suspendPaneRendering(panes, { owner: {}, livePanes: () => panes })

      expect(retainedHiddenWebglOwnerCountForTest()).toBe(0)
      for (const [paneIndex, pane] of panes.entries()) {
        expect(addons[paneIndex]?.dispose).toHaveBeenCalledOnce()
        expect(pane.webglAddon).toBeNull()
        expect(pane.webglAttachmentDeferred).toBe(true)
        expect(pane.terminal.options.cursorBlink).toBe(false)
      }
    }
  })

  it('restores rendering eligibility and cursor state on reveal', () => {
    const owner = {}
    const panes = [createPane()]
    suspendPaneRendering(panes, { owner, livePanes: () => panes })
    resumePaneRendering(panes, owner)

    expect(retainedHiddenWebglOwnerCountForTest()).toBe(0)
    expect(panes[0].webglAttachmentDeferred).toBe(false)
    expect(panes[0].gpuRenderingEnabled).toBe(true)
    expect(panes[0].terminal.options.cursorBlink).toBe(true)
  })
})
