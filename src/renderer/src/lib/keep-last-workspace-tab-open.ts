import { toast } from 'sonner'
import { useAppStore } from '@/store'

// RA: Unified tabs include editors and browsers; retain the terminal mirror during hydration.
export function keepLastWorkspaceTabOpen(worktreeId: string): boolean {
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
