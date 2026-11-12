// RA: Hiding changes presentation only; the host keeps its tab, PTY and orchestration custody.
import type { AppState } from '@/store/types'
import { selectWorktreeAgentOrchestration } from '../sidebar/workspace-card/activity/worktree-agent-orchestration-index'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { selectTabAgentParents } from '../tab-bar/tab-agent-lineage'
const opened = new Set<string>()
const listeners = new Set<() => void>()
let revision = 0
export const workerVisibilityRevision = () => revision
export const subscribeWorkerVisibility = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function revealWorkerTab(tabId: string): void {
  if (opened.has(tabId)) return
  opened.add(tabId); revision++; listeners.forEach((listener) => listener())
}
export function isWorkerTab(state: AppState, worktreeId: string, tabId: string): boolean {
  const tabs = state.tabsByWorktree[worktreeId] ?? []
  const unified = state.unifiedTabsByWorktree[worktreeId]?.find((t) => t.id === tabId || t.entityId === tabId)
  const id = unified?.entityId ?? tabId
  // The worker factory labels its tab before the first push-fed orchestration snapshot arrives.
  if (tabs.some((t) => t.id === id && [t.customTitle, t.defaultTitle, t.title].some((title) => title && /^worker-task_/.test(title)))) return true
  return Object.entries(selectWorktreeAgentOrchestration(state, worktreeId)).some(([key, context]) =>
    Boolean(context.dispatchId && parsePaneKey(key)?.tabId === id))
}
export function isWorkerTabHidden(state: AppState, worktreeId: string, tabId: string): boolean {
  if (state.settings?.workerTabsShown === true) return false
  const row = state.unifiedTabsByWorktree[worktreeId]?.find((t) => t.id === tabId || t.entityId === tabId)
  return !opened.has(tabId) && !opened.has(row?.entityId ?? tabId) && isWorkerTab(state, worktreeId, tabId)
}
export function hideWorkerTabOnClose(state: AppState, tabId: string): boolean {
  if (state.settings?.workerTabsShown === true) return false
  for (const [worktreeId, tabs] of Object.entries(state.tabsByWorktree)) {
    const row = state.unifiedTabsByWorktree[worktreeId]?.find((t) => t.id === tabId || t.entityId === tabId)
    const id = row?.entityId ?? tabId
    if (!tabs.some((t) => t.id === id) || !isWorkerTab(state, worktreeId, id)) continue
    opened.delete(id); opened.delete(row?.id ?? id)
    const parent = selectTabAgentParents(state, worktreeId).get(row?.id ?? id)
    const next = tabs.find((t) => t.id === parent) ?? tabs.find((t) => t.id !== id && !isWorkerTabHidden(state, worktreeId, t.id))
    if (next) state.setActiveTab(next.id)
    revision++; listeners.forEach((listener) => listener())
    return true
  }
  return false
}
