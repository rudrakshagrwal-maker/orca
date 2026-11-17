import { BrowserWebAuthnAccountDialog } from './components/browser-webauthn-account-dialog'
import { BrowserExtensionInstallDialog } from './components/browser-extension-install-dialog'
import { BrowserPagePrompts } from './components/browser-pane/browser-page-prompts'
import { useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ConfirmationDialogProvider } from './components/confirmation-dialog'
import { LinkRoutingPreferenceDialogProvider } from './components/link-routing-preference-dialog'
import PinnedTabCloseDialog from './components/terminal-pane/layout/close/PinnedTabCloseDialog'
import RunningTerminalCloseDialog from './components/terminal-pane/layout/close/RunningTerminalCloseDialog'
import WorktreeBaseFallbackDialog from './components/WorktreeBaseFallbackDialog'
import ClaudeAccountSwitchDialog from './components/ClaudeAccountSwitchDialog'
import { useUnreadDockBadge } from './hooks/useUnreadDockBadge'
import { AppBackgroundServices } from './app-shell/AppBackgroundServices'
import { AppRootSurfaces } from './app-shell/AppRootSurfaces'
import { AppWorkspaceShell } from './app-shell/AppWorkspaceShell'
import { WindowControls } from './app-shell/WindowControls'
import {
  MAC_TRAFFIC_LIGHTS_WIDTH,
  WINDOW_CONTROLS_HEIGHT,
  WINDOW_CONTROLS_WIDTH,
  hasCustomTitleBar
} from './app-shell/app-window-chrome'
import { useAppChromeLayout } from './app-shell/use-app-chrome-layout'
import { useAppSessionPersistence } from './app-shell/use-app-session-persistence'
import { useAppShellServices } from './app-shell/use-app-shell-services'
import { useAppStartupHydration } from './app-shell/use-app-startup-hydration'
import { startNativeChatDraftLoad } from './app-shell/native-chat-draft-startup'
import { runWslMoveRendererStoreRewrites } from './lib/workspace/persistence/wsl-move-renderer-store-rewrites'
import { runWslDriveUncRendererStoreRewrites } from './lib/workspace/persistence/wsl-drive-unc-renderer-store-rewrites'
import { useDocumentAppearance } from './app-shell/use-document-appearance'
import { useGlobalKeybindings } from './app-shell/use-global-keybindings'
import { usePersistedUIWriter } from './app-shell/use-persisted-ui-writer'
import { useRuntimeGraphSync } from './app-shell/use-runtime-graph-sync'
import { useWindowVisibilityEffects } from './app-shell/use-window-visibility-effects'
import { PlainSshTerminalPanels } from './components/plain-ssh-terminal/PlainSshTerminalPanels'
import { AddToChatPointMenuHost } from './components/native-chat/selection-quotes/AddToChatMenu'
import { installActiveWorktreeRemovalSuccessor } from './lib/workspace/activation/active-worktree-removal-successor'

// RA: retain browser prompts; Space and plugin replay hosts are removed.
function App(): React.JSX.Element {
  const layout = useAppChromeLayout()
  const clearUnreadDockBadge = useUnreadDockBadge(false)

  useAppShellServices()
  // Load drafts before the startup chain so no failed step can skip them.
  useEffect(startNativeChatDraftLoad, [])
  // Committed WSL moves only: the list is empty otherwise, and always with the internal gate closed.
  useEffect(() => void runWslMoveRendererStoreRewrites(), [])
  // A Windows-drive conversion's own stores, after the restart that converted the project.
  useEffect(() => void runWslDriveUncRendererStoreRewrites(), [])
  useAppStartupHydration()
  useAppSessionPersistence()
  useRuntimeGraphSync()
  usePersistedUIWriter()
  useDocumentAppearance()
  useWindowVisibilityEffects()
  useGlobalKeybindings({ layout })
  // App owns active-selection removal; the Space window only mirrors selection.
  useEffect(() => installActiveWorktreeRemovalSuccessor(), [])

  // Portaled sheets/dialogs live outside .app-layout and need root offsets to clear Windows/Linux controls.
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--window-controls-width', WINDOW_CONTROLS_WIDTH)
    root.setProperty('--window-controls-height', WINDOW_CONTROLS_HEIGHT)
    root.setProperty('--mac-traffic-lights-width', MAC_TRAFFIC_LIGHTS_WIDTH)
  }, [])

  const setAppRootNode = useCallback(
    (node: HTMLDivElement | null): void => {
      // Cancel chrome cleanup work when the App root unmounts.
      if (!node) {
        clearUnreadDockBadge()
      }
    },
    [clearUnreadDockBadge]
  )

  return (
    <div
      ref={setAppRootNode}
      className="app-layout"
      style={
        {
          '--collapsed-sidebar-header-width': `${layout.collapsedSidebarHeaderWidth}px`,
          // Shared so surfaces can avoid the Windows/Linux window-controls overlay without hardcoding 138px everywhere.
          '--window-controls-width': WINDOW_CONTROLS_WIDTH,
          // Side-position activity bar uses this to push icons below the Windows/Linux window-controls overlay.
          '--window-controls-height': WINDOW_CONTROLS_HEIGHT,
          // Full-bleed surfaces use this to keep the macOS traffic lights uncovered.
          '--mac-traffic-lights-width': MAC_TRAFFIC_LIGHTS_WIDTH
        } as React.CSSProperties
      }
    >
      <TooltipProvider>
        <ConfirmationDialogProvider>
          <BrowserPagePrompts />
          <BrowserWebAuthnAccountDialog />
          <BrowserExtensionInstallDialog />
          <AddToChatPointMenuHost />
          <LinkRoutingPreferenceDialogProvider>
            <AppBackgroundServices />
            <AppWorkspaceShell layout={layout} />
            <AppRootSurfaces />
          </LinkRoutingPreferenceDialogProvider>
        </ConfirmationDialogProvider>
        {createPortal(
          <Toaster closeButton toastOptions={{ className: 'font-sans text-sm' }} />,
          document.body
        )}
        <PlainSshTerminalPanels />
      </TooltipProvider>
      {/* RA: Skill updates remain user-invoked; never mount the automatic nudge. */}
      <WorktreeBaseFallbackDialog />
      <ClaudeAccountSwitchDialog />
      <PinnedTabCloseDialog />
      <RunningTerminalCloseDialog />
      {/* Electron drag hit-testing follows DOM order, ignoring z-index; render controls last to keep them clickable. */}
      {hasCustomTitleBar && <WindowControls />}
    </div>
  )
}

export default App
