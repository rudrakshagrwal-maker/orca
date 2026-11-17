import type { ActivityTerminalPortalTarget } from './activity/activity-terminal-portal'
import TerminalPaneOverlayLayer from './terminal-pane/mounting/TerminalPaneOverlayLayer'
import { lazyWithRetry as lazy } from '@/app-shell/startup/lazy-with-retry'
import { Suspense } from 'react'
import type { HiddenTerminalPrewarm } from './terminal-pane/controller/terminal-pane-types'
// RA: disabled feature renderers must not join the terminal's eager import graph.
const RetainedBrowserPaneOverlayLayer = lazy(() =>
  import('./browser-pane/assemble-chrome/BrowserPaneOverlayLayer').then((m) => ({
    default: m.RetainedBrowserPaneOverlayLayer
  }))
)

/** Share retained pane hosts across group-tree hosts so retention, parking and browser paint have one lifecycle owner. */
export function WorkspacePaneOverlayLayers({
  worktreeId,
  worktreePath,
  isVisible,
  shouldMeasureHiddenWorktree,
  hiddenTerminalPrewarm = null,
  shouldColdParkTerminalPanes,
  isForceParked,
  activityTerminalPortals,
  backgroundMountTabIds,
  activationDeferredMountTabIds,
  mountRetainedBrowserOverlay,
  ownsNativeChatToggleShortcut = true
}: {
  worktreeId: string
  worktreePath: string
  isVisible: boolean
  shouldMeasureHiddenWorktree: boolean
  hiddenTerminalPrewarm?: HiddenTerminalPrewarm | null
  shouldColdParkTerminalPanes: boolean
  isForceParked: boolean
  activityTerminalPortals: ActivityTerminalPortalTarget[]
  backgroundMountTabIds: ReadonlySet<string> | null
  activationDeferredMountTabIds: ReadonlySet<string> | null
  mountRetainedBrowserOverlay: boolean
  /** Floating overlays leave the toggle chord to the active workspace; duplicate listeners would both toggle. */
  ownsNativeChatToggleShortcut?: boolean
}): React.JSX.Element {
  return (
    <>
      <TerminalPaneOverlayLayer
        worktreeId={worktreeId}
        worktreePath={worktreePath}
        isWorktreeActive={isVisible}
        coldParkTerminalPanes={shouldColdParkTerminalPanes}
        isForceParked={isForceParked}
        shouldMeasureHiddenWorktree={shouldMeasureHiddenWorktree}
        hiddenTerminalPrewarm={hiddenTerminalPrewarm}
        activityTerminalPortals={activityTerminalPortals}
        backgroundMountTabIds={backgroundMountTabIds}
        activationDeferredMountTabIds={activationDeferredMountTabIds}
        ownsNativeChatToggleShortcut={ownsNativeChatToggleShortcut}
      />
      {/* RA: the browser stays available without removed background services. */}
      <Suspense fallback={null}>
        <RetainedBrowserPaneOverlayLayer
          worktreeId={worktreeId}
          isWorktreeActive={isVisible}
          mountEligible={mountRetainedBrowserOverlay}
        />
      </Suspense>
    </>
  )
}
