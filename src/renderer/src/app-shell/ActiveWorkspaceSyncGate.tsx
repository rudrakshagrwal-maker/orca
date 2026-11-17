import { useAppStore } from '../store'
import { useGitStatusPolling } from '../components/right-sidebar/source-control/sync/useGitStatusPolling'
import { useWebSessionTabsSync } from '../runtime/web-session-tabs-sync/use-web-session-tabs-sync'

/** Hosts services that track the active workspace, so a switch re-renders this null node instead of App. */
export function ActiveWorkspaceSyncGate(): null {
  const workspaceSessionReady = useAppStore((s) => s.workspaceSessionReady)
  useWebSessionTabsSync()
  // RA: refresh on focus/selection only; the sidebar no longer owns git timers.
  useGitStatusPolling({ enabled: workspaceSessionReady })
  // RA: editor watchers and hosted-review publishers stay unloaded.
  return null
}
