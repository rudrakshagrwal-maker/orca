import { useAppStore } from '../store'
import { shortcutPlatform } from './app-window-chrome'
import { isPairedWebClientWindow } from '@/lib/desktop-window-chrome'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'

// RA: Restore first, then open this Windows desktop on the local Workspace checkout.
export async function openWorkspaceAtStartup(isCancelled: () => boolean): Promise<void> {
  if (shortcutPlatform !== 'win32' || isPairedWebClientWindow() || isCancelled()) {
    return
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
    (await useAppStore.getState().addRepoPath(workspacePath, 'git', {
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
    const { activateAndRevealWorktree } = await import('@/lib/worktree-activation')
    if (!isCancelled()) {
      activateAndRevealWorktree(mainWorktree.id, {
        executionHostId: LOCAL_EXECUTION_HOST_ID,
        runtimeEnvironmentId: null
      })
    }
  }
}
