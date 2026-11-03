import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { paneIsCoveredByNativeChat } from './native-chat-covered-pane'

type PaneDirection = 'left' | 'right' | 'up' | 'down'

function isVisibleTerminalPane(container: HTMLElement): boolean {
  if (paneIsCoveredByNativeChat({ container })) {
    return false
  }
  // RA: Hidden startup tabs can retain measurable panes with an invisible ancestor.
  for (let element: HTMLElement | null = container; element; element = element.parentElement) {
    const style = getComputedStyle(element)
    if (
      element.hidden ||
      element.inert ||
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      style.opacity === '0'
    ) {
      return false
    }
  }
  return true
}

// RA: Search the window's rendered panes, since each manager owns only one terminal tab.
export function focusTerminalPaneInDirection(manager: PaneManager, direction: PaneDirection): void {
  const current = manager.getActivePane() ?? manager.getPanes()[0]
  if (!current) {
    return
  }
  const currentRect = current.container.getBoundingClientRect()
  if (currentRect.width <= 0 || currentRect.height <= 0) {
    return
  }
  const currentX = (currentRect.left + currentRect.right) / 2
  const currentY = (currentRect.top + currentRect.bottom) / 2
  const horizontal = direction === 'left' || direction === 'right'
  let nearest: { container: HTMLElement; tabId: string; leafId: string } | undefined
  let nearestOverlaps = false
  let nearestDistance = Infinity
  for (const container of current.container.ownerDocument.querySelectorAll<HTMLElement>(
    '.pane[data-leaf-id]'
  )) {
    if (container === current.container) {
      continue
    }
    const tabId = container.closest<HTMLElement>('[data-terminal-tab-id]')?.dataset.terminalTabId
    const leafId = container.dataset.leafId
    if (!tabId || !leafId || !isVisibleTerminalPane(container)) {
      continue
    }
    const rect = container.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      continue
    }
    const dx = (rect.left + rect.right) / 2 - currentX
    const dy = (rect.top + rect.bottom) / 2 - currentY
    const delta = horizontal ? dx : dy
    if (direction === 'left' || direction === 'up' ? delta >= 0 : delta <= 0) {
      continue
    }
    const overlaps = horizontal
      ? rect.top < currentRect.bottom && rect.bottom > currentRect.top
      : rect.left < currentRect.right && rect.right > currentRect.left
    const distance = dx * dx + dy * dy
    if (
      (overlaps && !nearestOverlaps) ||
      (overlaps === nearestOverlaps && distance < nearestDistance)
    ) {
      nearest = { container, tabId, leafId }
      nearestOverlaps = overlaps
      nearestDistance = distance
    }
  }
  if (!nearest) {
    return
  }
  const { container, tabId, leafId } = nearest
  const localPane = manager.getPanes().find((pane) => pane.container === container)
  if (localPane) {
    manager.setActivePane(localPane.id, { focus: true })
  } else {
    activateTabAndFocusPane(tabId, leafId)
  }
}
