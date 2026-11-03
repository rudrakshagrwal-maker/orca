import { toast } from 'sonner'
import { useAppStore } from '@/store'

// RA: Keyboard closes never prompt to remove a pinned tab, even when other tabs remain.
export function keepPinnedWorkspaceTabOpen(worktreeId: string, tabId?: string): boolean {
  const state = useAppStore.getState()
  const tab = tabId
    ? state.unifiedTabsByWorktree[worktreeId]?.find(
        (candidate) => candidate.id === tabId || candidate.entityId === tabId
      )
    : state.getActiveTab(worktreeId)
  if (!tab?.isPinned) {
    return false
  }
  toast.info('Pinned tab: unpin to close', { duration: 2000 })
  return true
}

// RA: Unified tabs include editors and browsers; retain the terminal mirror during hydration.
export function keepLastWorkspaceTabOpen(worktreeId: string, tabId?: string): boolean {
  if (keepPinnedWorkspaceTabOpen(worktreeId, tabId)) {
    return true
  }
  const state = useAppStore.getState()
  if (
    (state.tabsByWorktree[worktreeId]?.length ?? 0) > 1 ||
    (state.unifiedTabsByWorktree[worktreeId]?.length ?? 0) > 1
  ) {
    return false
  }
  toast.info('Last tab: Ctrl+W keeps the workspace open', { duration: 2000 })
  return true
}
