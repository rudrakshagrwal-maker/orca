import type { WorkspaceSessionState } from './workspace-session-state-types'
import { isTerminalLeafId, makePaneKey, parsePaneKey } from './stable-pane-id'
import {
  collectLayoutLeafIdsInOrder,
  resolveRootlessTerminalLayoutLeafId
} from './workspace-layout/terminal-pane-tree'

// RA: durable pane identities survive handle replacement and moving a pane into a new tab.
export function reconcileTerminalLaunchParents(session: WorkspaceSessionState): WorkspaceSessionState {
  const parents = session.terminalLaunchParentsByPaneKey
  if (!parents) {
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
  const next: Record<string, string> = {}
  let changed = false
  for (const [child, parent] of Object.entries(parents)) {
    const childPane = resolve(child)
    const parentPane = resolve(parent)
    if (!childPane || !parentPane || childPane === parentPane) {
      changed = true
      continue
    }
    next[childPane] = parentPane
    changed ||= childPane !== child || parentPane !== parent
  }
  return changed ? { ...session, terminalLaunchParentsByPaneKey: next } : session
}
