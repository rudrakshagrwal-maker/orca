import { Suspense, useRef } from 'react'
import { lazyWithRetry as lazy } from '@/app-shell/startup/lazy-with-retry'
import { useTranslate } from '@/i18n/use-translate'

import Sidebar from '../components/Sidebar'
import { RecoverableRenderErrorBoundary } from '../components/error-boundaries/RecoverableRenderErrorBoundary'

import { TerminalWorkbenchContainer } from '../components/TerminalWorkbenchContainer'
import type { VirtualizedScrollAnchor } from '../hooks/useVirtualizedScrollAnchor'
import { TitlebarLeftControls } from './TitlebarLeftControls'
import { TitlebarMainStrip } from './TitlebarMainStrip'
import type { AppChromeLayout } from './use-app-chrome-layout'

// Skips the shell render each workspace switch causes; its props only change on toggle.

// RA: disabled panels stay outside the boot import graph; orchestration remains in Projects.

const Landing = lazy(() => import('../components/Landing'))

const Settings = lazy(() => import('../components/settings/Settings'))

const Terminal = lazy(() => import('../components/Terminal'))

type WorktreeSidebarScrollRefs = {
  scrollOffsetRef: React.MutableRefObject<number>
  scrollAnchorRef: React.MutableRefObject<VirtualizedScrollAnchor>
}

function WorktreeSidebar({
  layout,
  scrollRefs
}: {
  layout: AppChromeLayout
  scrollRefs: WorktreeSidebarScrollRefs
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <RecoverableRenderErrorBoundary
      boundaryId="sidebar.worktrees"
      surface="sidebar"
      resetKey={layout.activeView}
      title={t('auto.App.1468601e7b', 'The workspace list hit an error.')}
      description={
        layout.leftTitlebarChromeLayout.shouldMount
          ? t(
              'auto.App.bdc71dddc9',
              'The active workspace remains open. Retry the list or switch views.'
            )
          : t(
              'auto.App.cba0fafda5',
              'The active page remains open. Retry the list or switch views.'
            )
      }
    >
      <Sidebar
        worktreeScrollOffsetRef={scrollRefs.scrollOffsetRef}
        worktreeScrollAnchorRef={scrollRefs.scrollAnchorRef}
      />
    </RecoverableRenderErrorBoundary>
  )
}

// A chat-bound creation shows the chat itself, usable before its worktree exists.

function ActivePage({ layout }: { layout: AppChromeLayout }): React.JSX.Element {
  const { activeView, hasActiveWorktree, creationLayoutActive } = layout
  return (
    <>
      {activeView === 'settings' ? <Settings /> : null}

      {activeView === 'terminal' && !hasActiveWorktree && !creationLayoutActive ? (
        <Landing />
      ) : null}
    </>
  )
}

export function AppWorkspaceShell(props: { layout: AppChromeLayout }): React.JSX.Element {
  const t = useTranslate()
  const { layout } = props
  const titlebarLeftControls = <TitlebarLeftControls layout={layout} />
  const titlebarMainStrip = <TitlebarMainStrip layout={layout} />
  // Keep scroll memory above sidebar view remounts to preserve list position.
  const scrollOffsetRef = useRef(0)
  const scrollAnchorRef = useRef<VirtualizedScrollAnchor>(null)
  const sidebarScrollRefs = { scrollOffsetRef, scrollAnchorRef }
  // `orca plugin shot` captures the right sidebar, which the parked launcher floats over.

  return (
    // Avoid active-worktree reset keys that remount whole surfaces during wake.
    <RecoverableRenderErrorBoundary
      boundaryId="app.workspace-shell"
      surface="workspace-shell"
      resetKey={layout.activeView}
      title={t('auto.App.df1d56bf87', 'The workspace shell hit an error.')}
      description={t(
        'auto.App.8504ddf267',
        'The app is still running. Retry the shell or use the menu to report the crash details.'
      )}
    >
      {/* RA: Keep titlebar chrome outside the inset panel row. */}
      <div className="workspace-shell flex flex-row flex-1 min-w-0 max-w-full min-h-0 overflow-hidden">
        {/* Keep the non-workspace titlebar from spanning the right sidebar. */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          {/* Workspace tab groups reach the top; other pages retain the titlebar. */}
          {!layout.leftTitlebarChromeLayout.shouldMount ? (
            <div className="titlebar">
              <div className="flex items-center shrink-0 mr-2">{titlebarLeftControls}</div>
              {titlebarMainStrip}
            </div>
          ) : null}
          <div className="workspace-panels flex flex-row flex-1 min-w-0 min-h-0 overflow-hidden">
            {layout.showSidebar ? (
              layout.leftTitlebarChromeLayout.shouldMount ? (
                /* Remove the collapsed header from flex layout so panes reclaim the left edge. */
                <div
                  className={`workspace-sidebar-column flex min-h-0 flex-col shrink-0${layout.sidebarOpen ? '' : ' relative w-0 overflow-visible'}`}
                  data-open={layout.sidebarOpen}
                >
                  <div
                    // The floating header covers the center border; restore the seam and size to its own controls.
                    className={`titlebar-left${
                      layout.leftTitlebarChromeLayout.isFloating
                        ? ' titlebar-left-floating absolute top-0 left-0 z-10 w-max border-r border-border'
                        : ''
                    }`}
                    style={{
                      // Why: custom sidebar appearances are scoped to the sidebar root; mirror those vars onto the header in the same left-column panel.
                      ...(layout.sidebarOpen ? layout.leftSidebarStyle : undefined),
                      // Why: size from the wrapper's live width so the header tracks in-flight drag resizes (persisted to Zustand only on mouseup).
                      width: layout.sidebarOpen ? '100%' : undefined
                    }}
                  >
                    {titlebarLeftControls}
                  </div>
                  {/* Keep a shrinkable flex viewport below the fixed header so the sidebar can scroll. */}
                  <div className="flex min-h-0 flex-1">
                    <WorktreeSidebar layout={layout} scrollRefs={sidebarScrollRefs} />
                  </div>
                </div>
              ) : (
                <div
                  className="workspace-sidebar-column flex min-h-0 shrink-0"
                  data-open={layout.sidebarOpen}
                >
                  <WorktreeSidebar layout={layout} scrollRefs={sidebarScrollRefs} />
                </div>
              )
            ) : null}
            <div
              className="workspace-main-panel flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden"
              data-workspace-chrome={layout.workspaceChromeActive}
            >
              {/* Automations/artifacts own their headers; another titlebar would leave an empty stripe. */}
              {layout.stackedSidebarOpen &&
              layout.activeView !== 'automations' &&
              layout.activeView !== 'artifacts' ? (
                <div className="titlebar">{titlebarMainStrip}</div>
              ) : null}
              <div className="relative flex flex-1 min-w-0 min-h-0 overflow-hidden">
                {/* Match the open sidebar header’s alignment to prevent toggle jitter. */}

                <div className="flex flex-1 min-w-0 min-h-0 flex-col">
                  {layout.shouldMountTerminalWorkbench ? (
                    <TerminalWorkbenchContainer isVisible={layout.terminalWorkbenchVisible}>
                      <Suspense fallback={null}>
                        <RecoverableRenderErrorBoundary
                          boundaryId="terminal.workbench"
                          surface="terminal-workbench"
                          resetKey="terminal"
                          title={t('auto.App.5a9519aef0', 'The workspace workbench hit an error.')}
                          description={t(
                            'auto.App.98d4ea2823',
                            'Terminal, browser, or editor rendering failed in this workspace. Retry to remount it.'
                          )}
                        >
                          <Terminal />
                        </RecoverableRenderErrorBoundary>
                      </Suspense>
                    </TerminalWorkbenchContainer>
                  ) : null}
                  <Suspense fallback={null}>
                    <RecoverableRenderErrorBoundary
                      boundaryId={`page.${layout.activeView}`}
                      surface="page"
                      resetKey={layout.activeView}
                      title={t('auto.App.b7a714db1e', 'This page hit an error.')}
                      description={t(
                        'auto.App.03a14f6b5b',
                        'Retry the page or navigate to another Orca surface.'
                      )}
                    >
                      <ActivePage layout={layout} />
                    </RecoverableRenderErrorBoundary>
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Retain the shell for stable layout while heavy panels disconnect; tasks can unmount it. */}
      </div>
    </RecoverableRenderErrorBoundary>
  )
}
