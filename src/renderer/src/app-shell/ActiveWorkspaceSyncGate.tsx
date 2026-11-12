import { useAppStore } from '../store'
import { Suspense } from 'react'
import { lazyWithRetry as lazy } from './startup/lazy-with-retry'
import { useWebSessionTabsSync } from '../runtime/web-session-tabs-sync/use-web-session-tabs-sync'

// RA: terminal-only startup imports no Git polling or editor file watchers.
const ActiveEditorSourceControlSync = lazy(() => import('./ActiveEditorSourceControlSync'))

/** Hosts services that track the active workspace, so a switch re-renders this null node instead of App. */
export function ActiveWorkspaceSyncGate(): React.JSX.Element | null {
  const workspaceSessionReady = useAppStore((s) => s.workspaceSessionReady)
  const hasVisibleConsumer = useAppStore((state) => {
    if (state.activeView !== 'terminal') return false
    if (state.rightSidebarOpen && state.rightSidebarTab === 'source-control') return true
    const key = state.activeWorktreeId
    if (!key) return false
    const tabs = state.unifiedTabsByWorktree[key] ?? []
    return (state.groupsByWorktree[key] ?? []).some((group) => {
      const tab = tabs.find((candidate) => candidate.id === group.activeTabId)
      return tab && ['editor', 'diff', 'conflict-review', 'check-details'].includes(tab.contentType)
    })
  })
  useWebSessionTabsSync()
  return workspaceSessionReady && hasVisibleConsumer ? (
    <Suspense fallback={null}><ActiveEditorSourceControlSync /></Suspense>
  ) : null
}
