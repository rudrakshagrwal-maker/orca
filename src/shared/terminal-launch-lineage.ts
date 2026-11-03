import type { WorkspaceSessionState } from './workspace-session-state-types'
import { isTerminalLeafId, makePaneKey, parsePaneKey } from './stable-pane-id'
import {
  collectLayoutLeafIdsInOrder,
  resolveRootlessTerminalLayoutLeafId
} from './workspace-layout/terminal-pane-tree'

// RA: durable pane identities survive handle replacement and moving a pane into a new tab.
export function reconcileTerminalLaunchParents(session: WorkspaceSessionState): WorkspaceSessionState {
  const parents = session.terminalLaunchParentsByPaneKey
  if (!parents && !session.terminalOrchestratorTitlesByPaneKey) {
    return session
  }
  const paneByLeaf = new Map<string, string>()
  for (const [tabId, layout] of Object.entries(session.terminalLayoutsByTabId)) {
    if (!tabId || tabId.includes(':')) {
      continue
    }
    const leaves = layout.root
      ? collectLayoutLeafIdsInOrder(layout.root)
      : [resolveRootlessTerminalLayoutLeafId(layout)].filter((id): id is string => id !== null)
    for (const leafId of leaves) {
      if (isTerminalLeafId(leafId)) {
        paneByLeaf.set(leafId, makePaneKey(tabId, leafId))
      }
    }
  }
  const resolve = (key: string): string | undefined => {
    const pane = parsePaneKey(key)
    return pane ? paneByLeaf.get(pane.leafId) : undefined
  }
  // RA: walk upwards from live children so closed intermediate parents stay nested too.
  const normalized = new Map<string, string>()
  for (const [child, parent] of Object.entries(parents ?? {})) {
    const childPane = resolve(child) ?? child
    const parentPane = resolve(parent) ?? parent
    if (parsePaneKey(childPane) && parsePaneKey(parentPane) && childPane !== parentPane) {
      normalized.set(childPane, parentPane)
    }
  }
  const needed = new Set(paneByLeaf.values())
  for (const child of needed) {
    const parent = normalized.get(child)
    if (parent) {
      needed.add(parent)
    }
  }
  const next: Record<string, string> = {}
  let changed = false
  for (const [child, parent] of normalized) {
    if (needed.has(child)) {
      next[child] = parent
    }
  }
  changed = JSON.stringify(next) !== JSON.stringify(parents ?? {})
  // RA: remember crowns while the parent lives, or its closed row is still needed.
  const titles: Record<string, string> = {}
  const tabsById = new Map(Object.values(session.tabsByWorktree).flat().map((tab) => [tab.id, tab]))
  for (const [key, title] of Object.entries(session.terminalOrchestratorTitlesByPaneKey ?? {})) {
    const pane = resolve(key) ?? key
    if (needed.has(pane)) {
      titles[pane] = title
    }
  }
  for (const parent of Object.values(next)) {
    const tabId = parsePaneKey(parent)?.tabId
    const tab = tabId ? tabsById.get(tabId) : undefined
    titles[parent] = tab?.customTitle?.trim() || tab?.title.trim() || titles[parent] || 'Agent'
  }
  changed ||= JSON.stringify(titles) !== JSON.stringify(session.terminalOrchestratorTitlesByPaneKey ?? {})
  return changed
    ? { ...session, terminalLaunchParentsByPaneKey: next, terminalOrchestratorTitlesByPaneKey: titles }
    : session
}
