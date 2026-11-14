import { backgroundJobsDisabled } from '../../../shared/fork-background-policy'
import type { ActivityTerminalPortalTarget } from './activity/activity-terminal-portal'
import TerminalPaneOverlayLayer from './terminal-pane/mounting/TerminalPaneOverlayLayer'
import { lazyWithRetry as lazy } from '@/app-shell/startup/lazy-with-retry'
import { Suspense } from 'react'
import { useAppStore } from '@/store'
import type { HiddenTerminalPrewarm } from './terminal-pane/controller/terminal-pane-types'
// RA: disabled feature renderers must not join the terminal's eager import graph.
const RetainedBrowserPaneOverlayLayer = lazy(() =>
  import('./browser-pane/assemble-chrome/BrowserPaneOverlayLayer').then((m) => ({
    default: m.RetainedBrowserPaneOverlayLayer
  }))
)
const EmulatorPaneOverlayLayer = lazy(() => import('./emulator-pane/EmulatorPaneOverlayLayer'))
const StructuredAgentSessionPaneOverlayLayer = lazy(
  () => import('./native-chat/pane/routing/StructuredAgentSessionPaneOverlayLayer')
)
const AiVaultSessionDropLayer = lazy(() => import('./tab-group/AiVaultSessionDropLayer'))

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
  mountEmulatorOverlay,
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
  mountEmulatorOverlay: boolean
  /** Floating overlays leave the toggle chord to the active workspace; duplicate listeners would both toggle. */
  ownsNativeChatToggleShortcut?: boolean
}): React.JSX.Element {
  const hasBotChat = useAppStore((state) =>
    (state.unifiedTabsByWorktree[worktreeId] ?? []).some(
      (tab) => tab.contentType === 'agent-session' && tab.agentSessionAgent === 'hermes'
    )
  )
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
      {!backgroundJobsDisabled() ? (
        <Suspense fallback={null}>
          <RetainedBrowserPaneOverlayLayer
            worktreeId={worktreeId}
            isWorktreeActive={isVisible}
            mountEligible={mountRetainedBrowserOverlay}
          />
          {mountEmulatorOverlay ? (
            <EmulatorPaneOverlayLayer worktreeId={worktreeId} isWorktreeActive={isVisible} />
          ) : null}
          <AiVaultSessionDropLayer worktreeId={worktreeId} enabled={isVisible} />
        </Suspense>
      ) : null}
      {hasBotChat || !backgroundJobsDisabled() ? (
        <Suspense fallback={null}>
          <StructuredAgentSessionPaneOverlayLayer
            worktreeId={worktreeId}
            isWorktreeActive={isVisible}
          />
        </Suspense>
      ) : null}
    </>
  )
}
