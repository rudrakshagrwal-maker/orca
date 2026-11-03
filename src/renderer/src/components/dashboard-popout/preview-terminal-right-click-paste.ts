import type { Terminal } from '@xterm/xterm'
import { copyTerminalSelection } from '@/components/terminal-pane/terminal-selection-copy'
import { isWindowsUserAgent } from '@/components/terminal-pane/pane-helpers'
import type { PreviewTerminalPasteSource } from './preview-terminal-paste'
import {
  claimTerminalRightClickPasteMouseDown,
  isTerminalRightClickPasteGesture
} from '@/components/terminal-pane/terminal-right-click-paste-gesture'

type PreviewRightClickTerminal = Pick<Terminal, 'getSelection' | 'clearSelection' | 'focus'>

/** RA: Windows pastes; other platforms copy selections first. Ctrl+right-click retains menu access. */
export function installPreviewTerminalRightClickPaste({
  container,
  getTerminal,
  isRightClickToPasteEnabled,
  pasteClipboardText
}: {
  container: HTMLElement
  getTerminal: () => PreviewRightClickTerminal | null
  isRightClickToPasteEnabled: () => boolean
  pasteClipboardText: (
    activeElementAtDispatch: Element | null,
    source: PreviewTerminalPasteSource
  ) => void
}): () => void {
  const onContextMenu = (event: MouseEvent): void => {
    const terminal = getTerminal()
    if (!terminal || !isRightClickToPasteEnabled() || event.ctrlKey) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    // RA: Match Windows terminal panes: a selection must not turn paste into copy.
    if (!isWindowsUserAgent() && terminal.getSelection()) {
      void copyTerminalSelection({
        terminal,
        writeClipboardText: window.api.ui.writeTerminalClipboardText,
        clearSelectionOnSuccess: true
      }).catch(() => undefined)
      return
    }
    pasteClipboardText(document.activeElement, 'right-click')
  }
  const onMouseDown = (event: MouseEvent): void => {
    const terminal = getTerminal()
    if (terminal && isTerminalRightClickPasteGesture(event, isRightClickToPasteEnabled())) {
      claimTerminalRightClickPasteMouseDown(event, terminal)
    }
  }
  container.addEventListener('mousedown', onMouseDown, true)
  container.addEventListener('contextmenu', onContextMenu)
  return () => {
    container.removeEventListener('mousedown', onMouseDown, true)
    container.removeEventListener('contextmenu', onContextMenu)
  }
}
