import { useAppStore } from '../store'
import { shortcutPlatform } from './app-window-chrome'
import { isPairedWebClientWindow } from '@/app-shell/chrome/desktop-window-chrome'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import { getActiveSidebarWorkspaceId } from '../../../shared/workspace-scope' // RA: includes folders.
import { selectWorkspaceByHostTarget } from '@/store/workspaces/selection/workspace-host-target'

// RA: Hydration owns the saved tab/PTY; fallback only when its workspace disappeared.
export async function openWorkspaceAtStartup(isCancelled: () => boolean): Promise<void> {
  if (shortcutPlatform !== 'win32' || isPairedWebClientWindow() || isCancelled()) {
    return
  }
  const restored = useAppStore.getState()
  const active = getActiveSidebarWorkspaceId(restored.activeWorkspaceKey, restored.activeWorktreeId)
  // RA: accept the scoped folder owner or a valid older session's legacy selection.
  for (const id of new Set([active, restored.activeWorktreeId])) {
    if (id && selectWorkspaceByHostTarget(restored, {
      id, hostId: restored.activeWorkspaceExecutionHostId ?? LOCAL_EXECUTION_HOST_ID
    })) return
  }
  const workspacePath = 'C:\\Users\\Rudraksh\\Documents\\Workspace'
  const normalizePath = (path: string): string =>
    path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const repo =
    useAppStore.getState().repos.find(
      (candidate) =>
        getRepoExecutionHostId(candidate) === LOCAL_EXECUTION_HOST_ID &&
        normalizePath(candidate.path) === normalizePath(workspacePath)
    ) ??
    (await useAppStore.getState().addRepoPath(workspacePath, 'folder', {
      displayName: 'Workspace',
      runtimeEnvironmentId: null
    }))
  if (!repo || isCancelled()) {
    return
  }
  await useAppStore.getState().fetchWorktrees(repo.id, { executionHostId: LOCAL_EXECUTION_HOST_ID })
  if (isCancelled()) {
    return
  }
  const mainWorktree = selectWorktreesByRepo(useAppStore.getState())[repo.id]?.find(
    (worktree) =>
      worktree.isMainWorktree &&
      (worktree.hostId ?? LOCAL_EXECUTION_HOST_ID) === LOCAL_EXECUTION_HOST_ID
  )
  if (mainWorktree) {
    const { activateAndRevealWorktree } = await import('@/lib/workspace/activation/worktree-activation')
    if (!isCancelled()) {
      // RA: Queue atomically before activation can seed or mount a bare shell.
      const state = useAppStore.getState()
      if (
        !state.tabsByWorktree[mainWorktree.id]?.length &&
        !state.unifiedTabsByWorktree[mainWorktree.id]?.some((tab) => tab.contentType === 'terminal')
      ) {
        state.createTab(mainWorktree.id, undefined, undefined, {
          launchAgent: 'claude',
          startupCwd: workspacePath,
          pendingStartup: { command: 'claude --dangerously-skip-permissions' },
          recordInteraction: false
        })
      }
      activateAndRevealWorktree(mainWorktree.id, {
        executionHostId: LOCAL_EXECUTION_HOST_ID,
        runtimeEnvironmentId: null,
        providesInitialSurface: true
      })
    }
  }
}
