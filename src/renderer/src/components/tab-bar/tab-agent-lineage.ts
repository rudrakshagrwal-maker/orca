import type { AppState } from '@/store/types'
import { getStructuredAgentSessionTabsByPaneKey } from '../native-chat/session/status/structured-agent-session-tabs'
import {
  selectLiveAgentStatusEntriesForWorktree,
  selectRetainedAgentEntriesForWorktree
} from '../sidebar/workspace-card/activity/worktree-agent-row-selectors'
// RA: upstream split orchestration selection from the agent row selectors.
import { selectWorktreeAgentOrchestration as selectRuntimeAgentOrchestrationForWorktree } from '../sidebar/workspace-card/activity/worktree-agent-orchestration-index'
import { entryWithRuntimeOrchestration } from '../sidebar/workspace-card/activity/worktree-agent-row-orchestration'
import { parseAgentStatusPaneIdentity } from '../../../../shared/agent-status/identity/agent-status-worktree-attribution'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'

type LineageCache = {
  retained: ReturnType<typeof selectRetainedAgentEntriesForWorktree>
  contexts: ReturnType<typeof selectRuntimeAgentOrchestrationForWorktree>
  represented: AppState['unifiedTabsByWorktree']
  tabIds: ReadonlySet<string>
}

// RA: Share the sidebar's push-fed lineage; index once per snapshot, with no per-tab polling.
const lineageByLiveEntries = new WeakMap<AgentStatusEntry[], LineageCache>()
const parentCache = new WeakMap<
  AgentStatusEntry[],
  {
    retained: LineageCache['retained']
    contexts: LineageCache['contexts']
    represented: LineageCache['represented']
    parents: ReadonlyMap<string, string>
  }
>()

// RA: resolve both launch-parent pane keys and terminal handles, including before the first hook.
export function selectTabAgentParents(
  state: AppState,
  worktreeId: string
): ReadonlyMap<string, string> {
  const contexts = selectRuntimeAgentOrchestrationForWorktree(state, worktreeId)
  const live = selectLiveAgentStatusEntriesForWorktree(state, worktreeId)
  const retained = selectRetainedAgentEntriesForWorktree(state, worktreeId)
  const cached = parentCache.get(live)
  if (
    cached?.retained === retained &&
    cached.contexts === contexts &&
    cached.represented === state.unifiedTabsByWorktree
  ) {
    return cached.parents
  }
  const represented = state.unifiedTabsByWorktree
    ? getStructuredAgentSessionTabsByPaneKey(state.unifiedTabsByWorktree)
    : undefined
  const rows = new Map<
    string,
    Pick<AgentStatusEntry, 'paneKey' | 'terminalHandle' | 'orchestration'>
  >()
  for (const row of retained) {
    rows.set(row.entry.paneKey, row.entry)
  }
  for (const entry of live) {
    rows.set(entry.paneKey, entry)
  }
  for (const [paneKey, context] of Object.entries(contexts)) {
    const old = rows.get(paneKey)
    rows.set(paneKey, { ...old, paneKey, orchestration: context })
  }
  const idFor = (key: string): string | undefined => {
    const owner = represented?.get(key)
    return owner?.id ?? parseAgentStatusPaneIdentity(key)?.tabId
  }
  const handles = new Map<string, string>()
  for (const row of rows.values()) {
    const id = idFor(row.paneKey)
    if (id && row.terminalHandle) {
      handles.set(row.terminalHandle, id)
    }
  }
  const parents = new Map<string, string>()
  for (const row of rows.values()) {
    const child = idFor(row.paneKey)
    const context = row.orchestration
    const parent =
      (context?.parentPaneKey ? idFor(context.parentPaneKey) : undefined) ??
      handles.get(context?.parentTerminalHandle ?? context?.coordinatorHandle ?? '')
    if (child && parent && child !== parent) {
      parents.set(child, parent)
    }
  }
  // RA: reject corrupt cycles before automatic cross-pane placement can chase them.
  const candidates = new Map(parents)
  for (const child of candidates.keys()) {
    const seen = new Set([child])
    let ancestor = candidates.get(child)
    while (ancestor && !seen.has(ancestor)) {
      seen.add(ancestor)
      ancestor = candidates.get(ancestor)
    }
    if (ancestor) {
      parents.delete(child)
    }
  }
  parentCache.set(live, { retained, contexts, represented: state.unifiedTabsByWorktree, parents })
  return parents
}

export function selectTabIsSubagent(state: AppState, worktreeId: string, tabId: string): boolean {
  const live = selectLiveAgentStatusEntriesForWorktree(state, worktreeId)
  const retained = selectRetainedAgentEntriesForWorktree(state, worktreeId)
  const contexts = selectRuntimeAgentOrchestrationForWorktree(state, worktreeId)
  const cached = lineageByLiveEntries.get(live)
  if (
    cached?.retained === retained &&
    cached.contexts === contexts &&
    cached.represented === state.unifiedTabsByWorktree
  ) {
    return cached.tabIds.has(tabId)
  }

  const represented = state.unifiedTabsByWorktree
    ? getStructuredAgentSessionTabsByPaneKey(state.unifiedTabsByWorktree)
    : undefined
  const tabIds = new Set<string>()
  const seen = new Set<string>()
  const add = (
    entry: Pick<AgentStatusEntry, 'paneKey' | 'terminalHandle' | 'orchestration'>
  ): void => {
    if (seen.has(entry.paneKey)) {
      return
    }
    seen.add(entry.paneKey)
    const context = entry.orchestration
    const hasParent =
      (context?.parentPaneKey && context.parentPaneKey !== entry.paneKey) ||
      [context?.parentTerminalHandle, context?.coordinatorHandle].some(
        (handle) => handle && handle !== entry.terminalHandle
      )
    if (!hasParent) {
      return
    }
    const owner = represented?.get(entry.paneKey)
    const id = owner?.id ?? parseAgentStatusPaneIdentity(entry.paneKey)?.tabId
    if (id) {
      tabIds.add(id)
    }
  }
  for (const entry of live) {
    add(entryWithRuntimeOrchestration(entry, contexts))
  }
  for (const row of retained) {
    add(entryWithRuntimeOrchestration(row.entry, contexts))
  }
  for (const [paneKey, orchestration] of Object.entries(contexts)) {
    add({ paneKey, orchestration })
  }
  lineageByLiveEntries.set(live, {
    retained,
    contexts,
    represented: state.unifiedTabsByWorktree,
    tabIds
  })
  return tabIds.has(tabId)
}
