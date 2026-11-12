import { useEffect } from 'react'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { keepPinnedWorkspaceTabOpen } from '@/lib/keep-last-workspace-tab-open'
import {
  FLOATING_WORKSPACE_GUEST_CLOSE_EVENT,
  FLOATING_WORKSPACE_GUEST_SELECT_INDEX_EVENT,
  type FloatingWorkspaceGuestCloseDetail,
  type FloatingWorkspaceGuestSelectIndexDetail
} from '@/components/floating-terminal/floating-workspace-guest-bridge'
import type { FloatingTerminalPanelShortcuts } from './use-floating-terminal-panel-shortcuts'

type FloatingTerminalGuestBridgeInput = Pick<
  FloatingTerminalPanelShortcuts,
  'floatingShortcutListenersRef'
> & { open: boolean }

export function useFloatingTerminalGuestBridge({
  floatingShortcutListenersRef,
  open
}: FloatingTerminalGuestBridgeInput): void {
  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return
    }
    const handleGuestClose = (event: Event): void => {
      const detail = (event as CustomEvent<FloatingWorkspaceGuestCloseDetail>).detail
      if (detail) {
        // RA: Browser-guest Ctrl+W must not open a pinned-close confirmation either.
        if (keepPinnedWorkspaceTabOpen(FLOATING_TERMINAL_WORKTREE_ID, detail.sourceId)) {
          return
        }
        floatingShortcutListenersRef.current.closeFloatingItemConfirmed(detail.sourceId, {
          guestOwned: true
        })
      }
    }
    const handleGuestSelectIndex = (event: Event): void => {
      const detail = (event as CustomEvent<FloatingWorkspaceGuestSelectIndexDetail>).detail
      const listeners = floatingShortcutListenersRef.current
      const visibleId = detail ? listeners.visibleFloatingTabOrder[detail.index] : undefined
      if (visibleId) {
        listeners.activateFloatingItem(visibleId)
      }
    }
    window.addEventListener(FLOATING_WORKSPACE_GUEST_CLOSE_EVENT, handleGuestClose)
    window.addEventListener(FLOATING_WORKSPACE_GUEST_SELECT_INDEX_EVENT, handleGuestSelectIndex)
    return () => {
      window.removeEventListener(FLOATING_WORKSPACE_GUEST_CLOSE_EVENT, handleGuestClose)
      window.removeEventListener(
        FLOATING_WORKSPACE_GUEST_SELECT_INDEX_EVENT,
        handleGuestSelectIndex
      )
    }
  }, [floatingShortcutListenersRef, open])
}
