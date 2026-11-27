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

// RA 23 Nov: Ctrl+W closes the last tab too; only pinned tabs are protected (was: last tab kept, 3 Nov).
export function keepLastWorkspaceTabOpen(worktreeId: string, tabId?: string): boolean {
  return keepPinnedWorkspaceTabOpen(worktreeId, tabId)
}
