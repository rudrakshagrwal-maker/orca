import type { Terminal } from '@xterm/xterm'
import type { ManagedPaneInternal } from '../pane-manager-types'
import { refreshTerminalDa1Owner } from '../terminal-protocol/terminal-da1-ownership'

// RA: agent text panes do not decode image protocols or allocate per-pane image canvases.
export function terminalRendersInlineImages(_terminal: Terminal): boolean {
  return false
}

export function attachInlineImages(pane: ManagedPaneInternal): void {
  detachInlineImages(pane)
}

export function detachInlineImages(pane: ManagedPaneInternal): void {
  pane.imageAttachmentDeferred = false
  if (pane.imageAddon) {
    try {
      pane.imageAddon.dispose()
    } catch {}
    pane.imageAddon = null
    refreshTerminalDa1Owner(pane.terminal)
  }
}

// RA: retain the settings API while keeping the streaming path text-only.
export function setInlineImagesEnabled(pane: ManagedPaneInternal, _enabled: boolean): void {
  detachInlineImages(pane)
}
