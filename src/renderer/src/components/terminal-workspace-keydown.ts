import { dispatchWorkspaceTabCommand } from '@/lib/workspace/tabs/workspace-tab-commands'
import { keybindingMatchesAction } from '../../../shared/keybindings'
import type { KeybindingActionId } from '../../../shared/keybindings'
import { matchesRecentTabSwitcherChord } from '../../../shared/window-shortcut-policy'
import { useAppStore } from '../store/index'

import { showTerminalShortcutCaptureNotification } from '@/lib/notifications/terminal-shortcut-capture-notification'
import {
  ensureClientCreationActionAllowed,
  showClientCreationActionError
} from '@/lib/workspace/creation/surface-policy/client-creation-action-error'

import { getKeybindingContext } from './terminal-workspace-model'

import { resolveTerminalAgentTabShortcut } from './terminal-agent-tab-shortcut'
import { getDetectionTargetIdentityForWorktree } from '@/lib/agent-session/launch/inventory/agent-detection-target-inventory'
import { launchAgentTabShortcut } from './agent-tab-shortcut-launch'

import type { TerminalActivationController } from './use-terminal-activation-actions'

export function handleTerminalWorkspaceKeyDown(
  event: KeyboardEvent,
  controller: TerminalActivationController,
  shortcutPlatform: NodeJS.Platform
): void {
  const {
    activeWorktreeId,
    handleCloseAllFiles,
    handleNewBrowserTab,
    handleNewBrowserTabSplitRight,

    handleNewTab,
    keybindings,

    terminalShortcutPolicy
  } = controller
  if (!activeWorktreeId) {
    return
  }
  const context = getKeybindingContext(event.target)

  const matchShortcut = (actionId: KeybindingActionId): boolean =>
    keybindingMatchesAction(actionId, event, shortcutPlatform, keybindings, {
      context,
      terminalShortcutPolicy
    })
  const notifyTerminalCapture = (actionId: KeybindingActionId): void => {
    if (context !== 'terminal' || terminalShortcutPolicy !== 'orca-first') {
      return
    }
    showTerminalShortcutCaptureNotification({
      actionId,
      platform: shortcutPlatform,
      keybindings
    })
  }
  if (!event.repeat) {
    const agentShortcut = resolveTerminalAgentTabShortcut({
      activeWorktreeId: activeWorktreeId,
      keybindings,
      matchShortcut,
      includeTerminal: true
    })
    if (agentShortcut.actionId) {
      event.preventDefault()
      notifyTerminalCapture(agentShortcut.actionId)
      if (agentShortcut.actionId === 'tab.newTerminal') {
        {
          handleNewTab()
        }
        return
      }

      const detectionTarget = getDetectionTargetIdentityForWorktree(
        useAppStore.getState(),
        activeWorktreeId
      )
      launchAgentTabShortcut(activeWorktreeId, agentShortcut, () => {
        const latest = useAppStore.getState()
        return (
          latest.activeWorktreeId === activeWorktreeId &&
          getDetectionTargetIdentityForWorktree(latest, activeWorktreeId) === detectionTarget
        )
      })
      return
    }
  }

  if (!event.repeat && matchShortcut('tab.reopenClosed')) {
    event.preventDefault()
    notifyTerminalCapture('tab.reopenClosed')
    try {
      useAppStore.getState().reopenClosedTab(activeWorktreeId)
    } catch (error) {
      showClientCreationActionError(error)
    }
    return
  }
  if (!event.repeat && matchShortcut('tab.newBrowser')) {
    event.preventDefault()
    notifyTerminalCapture('tab.newBrowser')
    const browserWorkspaceId = activeWorktreeId
    if (!ensureClientCreationActionAllowed(browserWorkspaceId, 'managed-browser')) {
      return
    }

    handleNewBrowserTab()
    return
  }
  if (!event.repeat && matchShortcut('tab.newBrowserSplitRight')) {
    event.preventDefault()
    notifyTerminalCapture('tab.newBrowserSplitRight')
    if (ensureClientCreationActionAllowed(activeWorktreeId, 'managed-browser')) {
      handleNewBrowserTabSplitRight()
    }
    return
  }

  if (!event.repeat && matchShortcut('tab.close')) {
    // RA: This capture listener can run before the app-shell last-tab guard.
    if (dispatchWorkspaceTabCommand({ type: 'close', context, keepWorkspaceOpen: true })) {
      event.preventDefault()
      notifyTerminalCapture('tab.close')
    }
    return
  }
  if (!event.repeat && matchShortcut('tab.closeAll')) {
    event.preventDefault()
    notifyTerminalCapture('tab.closeAll')
    handleCloseAllFiles()
    return
  }
  if (
    matchesRecentTabSwitcherChord(event, shortcutPlatform, keybindings, {
      context,
      terminalShortcutPolicy
    })
  ) {
    return
  }
  // Claim held repeats without switching again, or the newly active terminal receives the shortcut’s byte fallback.
  const claimTabSwitch = (): boolean => {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    return !event.repeat
  }
  if (matchShortcut('tab.previousRecent')) {
    if (claimTabSwitch()) {
      dispatchWorkspaceTabCommand({
        type: 'previous-recent',
        floatingPanelOwned: false
      })
    }
    return
  }
  const switchSameTypeDirection = matchShortcut('tab.nextSameType')
    ? 1
    : matchShortcut('tab.previousSameType')
      ? -1
      : null
  const switchAllTypesDirection = matchShortcut('tab.nextAllTypes')
    ? 1
    : matchShortcut('tab.previousAllTypes')
      ? -1
      : null
  if (switchSameTypeDirection !== null || switchAllTypesDirection !== null) {
    if (!claimTabSwitch()) {
      return
    }
    notifyTerminalCapture(
      switchAllTypesDirection !== null
        ? switchAllTypesDirection === 1
          ? 'tab.nextAllTypes'
          : 'tab.previousAllTypes'
        : switchSameTypeDirection === 1
          ? 'tab.nextSameType'
          : 'tab.previousSameType'
    )
    dispatchWorkspaceTabCommand({
      type: 'switch',
      direction: switchAllTypesDirection ?? switchSameTypeDirection ?? 1,
      scope: switchAllTypesDirection !== null ? 'all-types' : 'same-type',
      floatingPanelOwned: false
    })
  }
  const terminalTabDirection = matchShortcut('tab.nextTerminal')
    ? 1
    : matchShortcut('tab.previousTerminal')
      ? -1
      : null
  if (terminalTabDirection !== null && claimTabSwitch()) {
    dispatchWorkspaceTabCommand({
      type: 'switch',
      direction: terminalTabDirection,
      scope: 'terminal',
      floatingPanelOwned: false
    })
  }
}
