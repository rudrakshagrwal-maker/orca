import { hasVisibleOverlay } from '@/lib/overlay-interaction/visible-overlay'
import { requestScrollToCurrentWorkspaceRevealAndRename } from '@/lib/workspace/navigation/scroll-to-current-workspace-status'
import { requestVirtualizedScrollAnchorRecord } from '@/hooks/requestVirtualizedScrollAnchorRecord'
import { showTerminalShortcutCaptureNotification } from '@/lib/notifications/terminal-shortcut-capture-notification'
import { shouldShowWorktreeHistoryControls } from './chrome/titlebar-worktree-history-controls'

import {
  getRenderedLineageChipKeys,
  resolveChildWorkspacesToggleGroupKey
} from '../components/sidebar/workspace-card/identity/child-workspaces-toggle-target'
import { requestTerminalTabRename } from '../components/tab-bar/terminal-tab-rename-request'
import {
  deleteActiveWorkspaceFromShortcut,
  resolveActiveWorkspaceDeleteTarget
} from '../components/sidebar/workspace-actions/deletion/active-workspace-delete'
import { useAppStore } from '../store/index'

import { resolveActiveTabRenameTarget } from './active-tab-rename-target'

import type {
  KeybindingActionId,
  KeybindingContext,
  PhysicalModifierToken
} from '../../../shared/keybindings'
import { shortcutPlatform } from './app-window-chrome'
export { useAppShortcutActions } from './use-app-shortcut-actions'
import type { useAppShortcutActions } from './use-app-shortcut-actions'

type AppStoreState = ReturnType<typeof useAppStore.getState>

// Share dispatch between KeyboardEvent and synthetic double-tap input.
export type ShortcutDispatchInput = {
  isComposing?: boolean
  altGraph?: boolean
  key?: string
  code?: string
  altKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  doubleTapModifier?: PhysicalModifierToken
  target: EventTarget | null
  defaultPrevented: boolean
  preventDefault: () => void
}

export type AppShortcutActions = ReturnType<typeof useAppShortcutActions>

export type AppShortcutState = {
  activeView: AppStoreState['activeView']
  activeWorktreeId: AppStoreState['activeWorktreeId']
  actions: AppShortcutActions
  creationLayoutActive: boolean
  keybindings: AppStoreState['keybindings']
  terminalShortcutPolicy: NonNullable<AppStoreState['settings']>['terminalShortcutPolicy']
  workspaceChromeActive: boolean
}

export function getKeybindingContext(target: EventTarget | null): KeybindingContext {
  return target instanceof HTMLElement && target.classList.contains('xterm-helper-textarea')
    ? 'terminal'
    : 'app'
}

export function createAppCommandHandlers(
  state: AppShortcutState,
  input?: ShortcutDispatchInput,
  keybindingContext: KeybindingContext = 'app',
  /** A plugin's `commands.run`: Orca's own action, never a plugin replacement (no loops). */
  _builtInOnly = false
): Map<KeybindingActionId, () => boolean> {
  const {
    activeView,
    activeWorktreeId,
    actions,
    creationLayoutActive,
    keybindings,
    terminalShortcutPolicy,
    workspaceChromeActive
  } = state
  const claim = (actionId: KeybindingActionId, run: () => void): boolean => {
    input?.preventDefault()
    if (
      input &&
      keybindingContext === 'terminal' &&
      (terminalShortcutPolicy ?? 'orca-first') === 'orca-first'
    ) {
      showTerminalShortcutCaptureNotification({
        actionId,
        platform: shortcutPlatform,
        keybindings
      })
    }
    // RA: terminal commands dispatch directly without plugin replacements.
    run()
    return true
  }
  return new Map<KeybindingActionId, () => boolean>([
    [
      'worktree.history.back',
      () => {
        if (creationLayoutActive || !shouldShowWorktreeHistoryControls(activeView)) {
          return false
        }
        return claim('worktree.history.back', () => useAppStore.getState().goBackWorktree())
      }
    ],
    [
      'worktree.history.forward',
      () => {
        if (creationLayoutActive || !shouldShowWorktreeHistoryControls(activeView)) {
          return false
        }
        return claim('worktree.history.forward', () => useAppStore.getState().goForwardWorktree())
      }
    ],
    ['sidebar.left.toggle', () => claim('sidebar.left.toggle', () => actions.toggleSidebar())],
    [
      'sidebar.sleepingWorkspaces.toggle',
      () =>
        claim('sidebar.sleepingWorkspaces.toggle', () => {
          const store = useAppStore.getState()
          const nextShowSleeping = !store.showSleepingWorkspaces
          store.setShowSleepingWorkspaces(nextShowSleeping)
          if (nextShowSleeping) {
            store.setSidebarOpen(true)
          }
        })
    ],
    [
      'sidebar.childWorkspaces.toggle',
      () => {
        const store = useAppStore.getState()
        // Locally controlled dialogs do not set activeModal.
        if (
          store.activeModal !== 'none' ||
          hasVisibleOverlay({ ignoreMatches: '[role="listbox"], [role="menu"]' })
        ) {
          return false
        }
        const groupKey = resolveChildWorkspacesToggleGroupKey(
          store,
          getRenderedLineageChipKeys(store)
        )
        if (!groupKey) {
          return false
        }
        return claim('sidebar.childWorkspaces.toggle', () => {
          const expanding = store.collapsedGroups.has(groupKey)
          // Match chip-click scroll anchoring to avoid viewport jumps.
          requestVirtualizedScrollAnchorRecord('[data-worktree-sidebar]')
          store.toggleCollapsedGroup(groupKey)
          if (expanding) {
            store.setSidebarOpen(true)
          }
        })
      }
    ],

    [
      'tab.rename',
      () => {
        if (!workspaceChromeActive) {
          return false
        }
        // Resolve both terminal and structured-chat rename targets; a terminal-only gate silently ignores chat.
        const tabId = resolveActiveTabRenameTarget(activeWorktreeId, useAppStore.getState())
        if (!tabId) {
          return false
        }
        return claim('tab.rename', () => requestTerminalTabRename(tabId))
      }
    ],
    [
      'workspace.rename',
      () => {
        if (!workspaceChromeActive || !activeWorktreeId) {
          return false
        }
        return claim('workspace.rename', () => {
          useAppStore.getState().setSidebarOpen(true)
          requestScrollToCurrentWorkspaceRevealAndRename()
        })
      }
    ],
    [
      'workspace.delete',
      () => {
        const store = useAppStore.getState()
        const target = resolveActiveWorkspaceDeleteTarget(store)
        if (!target) {
          return false
        }
        return claim('workspace.delete', () => {
          deleteActiveWorkspaceFromShortcut(store, target)
        })
      }
    ]
  ])
}
