import type { RightSidebarExplorerView } from '../../../../../../shared/ui-chrome-types'

export function getVisibleFileExplorerWorktreePath({
  explorerView,
  sidebarOpen,
  worktreePath
}: {
  explorerView: RightSidebarExplorerView
  sidebarOpen: boolean
  worktreePath: string | null
}): string | null {
  // Contents search leaves Files mounted; suppress hidden tree loads and macOS app-data probes.
  return sidebarOpen && explorerView === 'files' ? worktreePath : null
}

export function shouldResetFileExplorerForVisibleWorktree(
  lastResetWorktreePath: string | null,
  visibleWorktreePath: string | null
): visibleWorktreePath is string {
  return visibleWorktreePath !== null && lastResetWorktreePath !== visibleWorktreePath
}
