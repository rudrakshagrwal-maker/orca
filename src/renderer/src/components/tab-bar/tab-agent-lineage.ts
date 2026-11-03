import type { AppState } from '@/store/types'
import { getStructuredAgentSessionTabsByPaneKey } from '../native-chat/structured-agent-session-tabs'
import {
  selectLiveAgentStatusEntriesForWorktree,
  selectRetainedAgentEntriesForWorktree,
  selectRuntimeAgentOrchestrationForWorktree
} from '../sidebar/worktree-agent-row-selectors'
import { entryWithRuntimeOrchestration } from '../sidebar/worktree-agent-row-orchestration'
import { parseAgentStatusPaneIdentity } from '../../../../shared/agent-status-worktree-attribution'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'

type LineageCache = {
  retained: ReturnType<typeof selectRetainedAgentEntriesForWorktree>
  contexts: ReturnType<typeof selectRuntimeAgentOrchestrationForWorktree>
  represented: AppState['unifiedTabsByWorktree']
  tabIds: ReadonlySet<string>
}

// RA: Share the sidebar's push-fed lineage; index once per snapshot, with no per-tab polling.
const lineageByLiveEntries = new WeakMap<AgentStatusEntry[], LineageCache>()

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
  const add = (entry: Pick<AgentStatusEntry, 'paneKey' | 'terminalHandle' | 'orchestration'>): void => {
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
