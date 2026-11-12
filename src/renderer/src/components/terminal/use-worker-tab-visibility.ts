// RA: Shared presentation subscription never creates a renderer or terminal provider.
import { useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import { isWorkerTabHidden, subscribeWorkerVisibility, workerVisibilityRevision } from './worker-tab-visibility'
export function useWorkerTabHidden(worktreeId: string, tabId: string): boolean {
  useSyncExternalStore(subscribeWorkerVisibility, workerVisibilityRevision)
  return useAppStore((state) => isWorkerTabHidden(state, worktreeId, tabId))
}
export function useHiddenWorkerTabSignature(worktreeId: string): string {
  useSyncExternalStore(subscribeWorkerVisibility, workerVisibilityRevision)
  return useAppStore((state) => {
    // RA: legacy restored terminal rows can precede their unified tab projection.
    const ids = new Set((state.tabsByWorktree[worktreeId] ?? []).map((tab) => tab.id))
    for (const tab of state.unifiedTabsByWorktree[worktreeId] ?? []) { ids.add(tab.id); ids.add(tab.entityId) }
    return JSON.stringify([...ids].filter((id) => isWorkerTabHidden(state, worktreeId, id)))
  })
}
