// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import { TOGGLE_QUICK_COMMANDS_MENU_EVENT } from '@/lib/terminal/quick-commands/quick-commands-menu-events'

import { activateTabNumberShortcut } from '@/lib/keyboard/tab-number-shortcuts'

import { getVisibleWorktreeShortcutTargets } from '@/components/sidebar/worktree-list/listing/visible-worktrees'
import { activateAndRevealWorkspace } from '@/lib/workspace/activation/worktree-activation'
import { deleteActiveWorkspaceFromShortcut } from '@/components/sidebar/workspace-actions/deletion/active-workspace-delete'

import { useAppStore } from '../../store/index'

export function registerWorkspaceShortcutIpcBridge(unsubs: (() => void)[]): void {
  unsubs.push(
    window.api.ui.onOpenQuickOpen(() => {
      const store = useAppStore.getState()
      if (store.activeView === 'terminal' && store.activeWorktreeId !== null) {
        store.openModal('quick-open')
      }
    })
  )

  unsubs.push(
    window.api.ui.onToggleQuickCommandsMenu(() => {
      window.dispatchEvent(new CustomEvent(TOGGLE_QUICK_COMMANDS_MENU_EVENT))
    })
  )

  if (window.api.ui.onDeleteCurrentWorkspace) {
    unsubs.push(
      window.api.ui.onDeleteCurrentWorkspace(() => {
        deleteActiveWorkspaceFromShortcut(useAppStore.getState())
      })
    )
  }

  unsubs.push(
    window.api.ui.onJumpToWorktreeIndex((index) => {
      const store = useAppStore.getState()
      // Route Cmd+J digits to palette recents because main already prevented their native input.

      if (store.activeView !== 'terminal') {
        return
      }
      const visibleTargets = getVisibleWorktreeShortcutTargets()
      const target = visibleTargets[index]
      if (target) {
        activateAndRevealWorkspace(target.id, {
          navigationIntent: 'user-open',
          // Why: the digit addresses a workspace-list row, so show the list it acted on.
          showWorkspaceList: true,
          ...(target.executionHostId ? { executionHostId: target.executionHostId } : {})
        })
      }
    })
  )

  unsubs.push(
    window.api.ui.onJumpToTabIndex((index) => {
      // Why: dropped while Cmd+J is open — never switch tabs behind the overlay.

      activateTabNumberShortcut(index)
    })
  )

  unsubs.push(
    window.api.ui.onWorktreeHistoryNavigate((direction) => {
      const store = useAppStore.getState()
      // Why: mirror button visibility — worktree history nav is only meaningful in the terminal view, so no-op elsewhere.
      if (store.activeView !== 'terminal') {
        return
      }
      if (direction === 'back') {
        ;(() => store.goBackWorktree())()
      } else {
        ;(() => store.goForwardWorktree())()
      }
    })
  )
}
