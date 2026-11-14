import { getDefaultWorkspaceSession } from '../../shared/constants'
import type { Store } from './loading-store/store'
import type { WorkspaceSessionState } from '../../shared/workspace-session/workspace-session-state-types'
import { advanceTerminalTopologyRevision } from './terminal-topology/terminal-topology-membership'

type LaunchSessionStore = Pick<
  Store,
  | 'getSettings'
  | 'getWorkspaceSessionHostIds'
  | 'getWorkspaceSession'
  | 'setWorkspaceSession'
  | 'flushPendingOrThrowAsync'
>

function freshSession(saved: WorkspaceSessionState): WorkspaceSessionState {
  let fresh: WorkspaceSessionState = {
    ...getDefaultWorkspaceSession(),
    activeRepoId: saved.activeRepoId,
    activeWorktreeId: saved.activeWorktreeId,
    activeWorkspaceKey: saved.activeWorkspaceKey,
    activeWorkspaceExecutionHostId: saved.activeWorkspaceExecutionHostId,
    browserUrlHistory: saved.browserUrlHistory,
    workspaceDocHistory: saved.workspaceDocHistory,
    lastVisitedAtByWorktreeId: saved.lastVisitedAtByWorktreeId,
    clientHostedBrowserPagesByWorktree: {},
    clientHostedBrowserCloseIntentsByEnvironment:
      saved.clientHostedBrowserCloseIntentsByEnvironment,
    pairedTerminalTabCloseIntentsByEnvironment: saved.pairedTerminalTabCloseIntentsByEnvironment,
    terminalTopologyRevisionByRepoId: saved.terminalTopologyRevisionByRepoId
  }
  for (const worktreeId of Object.keys(saved.tabsByWorktree)) {
    fresh = advanceTerminalTopologyRevision(fresh, worktreeId)
  }
  return fresh
}

/** Main retains this gate for the app lifetime, including renderer reloads and reconnects. */
export function createFreshStartOnLaunchGate(
  store: LaunchSessionStore,
  stopPreviousSessions: () => Promise<void>
) {
  const enabled = store.getSettings().freshStartOnLaunch !== false
  let preparation: Promise<void> | undefined
  let launchPending = enabled
  const prepare = (): Promise<void> => {
    preparation ??= (async () => {
      if (!enabled) {
        return
      }
      await stopPreviousSessions()
      for (const hostId of store.getWorkspaceSessionHostIds()) {
        store.setWorkspaceSession(freshSession(store.getWorkspaceSession(hostId)), hostId)
      }
      await store.flushPendingOrThrowAsync()
    })()
    return preparation
  }
  return {
    prepare,
    claimLaunch: async (consume = true): Promise<boolean> => {
      await prepare()
      const claimed = launchPending
      if (consume) {
        launchPending = false
      }
      return claimed
    }
  }
}
