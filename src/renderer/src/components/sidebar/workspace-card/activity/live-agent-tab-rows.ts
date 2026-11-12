import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import type { TerminalTab } from '../../../../../../shared/workspace-layout/terminal-tab-types'
import { tabHasLivePty } from '../../../../../../shared/tab-has-live-pty'
import type { AgentRowState } from '../../../../../../shared/agent-status/presentation/agent-row-decay-state'
import type { PaneForegroundAgentEntry } from '@/store/slices/agent-status/pane-foreground-agent'
import { parseAgentStatusPaneIdentity } from '../../../../../../shared/agent-status/identity/agent-status-worktree-attribution'
import { orderAgentLineage } from '@/components/tab-bar/agent-lineage-order'
import type { AgentStatusOrchestrationContext } from '../../../../../../shared/agent-status/contracts/agent-status-types'

export type LiveAgentTabRow = {
  tab: TerminalTab
  agentType: string
  state: AgentRowState
  stateStartedAt: number
  paneKey?: string
  providerSessionId?: string
  depth: number
  taskTitle?: string
}

// RA: count open agent tabs, never retained sessions, synthetic children or stale ancestors.
export function liveAgentTabRows(
  tabs: readonly TerminalTab[],
  agents: readonly DashboardAgentRow[],
  ptyIdsByTabId: Record<string, string[]>,
  foreground: Record<string, PaneForegroundAgentEntry> = {},
  structuredTabIds: ReadonlySet<string> = new Set(),
  parents: ReadonlyMap<string, string> = new Map(),
  contexts: Readonly<Record<string, AgentStatusOrchestrationContext>> = {}
): LiveAgentTabRow[] {
  const byTab = new Map<string, DashboardAgentRow>()
  for (const row of agents) {
    if (row.rowSource === 'retained' || row.rowSource === 'subagent') {
      continue
    }
    const previous = byTab.get(row.tab.id)
    if (!previous || agentStateOrder(row.state) < agentStateOrder(previous.state)) {
      byTab.set(row.tab.id, row)
    }
  }
  const rows = tabs
    .flatMap((tab): LiveAgentTabRow[] => {
      const row = byTab.get(tab.id)
      const context =
        Object.entries(contexts).find(
          ([key]) => parseAgentStatusPaneIdentity(key)?.tabId === tab.id
        )?.[1] ?? row?.entry.orchestration
      const settled =
        context?.dispatchStatus === 'completed' ||
        context?.dispatchStatus === 'failed' ||
        context?.dispatchStatus === 'circuit_broken'
      if (
        !settled &&
        !structuredTabIds.has(tab.id) &&
        !tab.ptyId &&
        !tabHasLivePty(ptyIdsByTabId, tab.id)
      ) {
        return []
      }
      const paneForeground = Object.entries(foreground).filter(
        ([key]) => parseAgentStatusPaneIdentity(key)?.tabId === tab.id
      )
      if (
        !settled &&
        paneForeground.length &&
        paneForeground.every(([, item]) => item.shellForeground)
      ) {
        return []
      }
      // RA: own foreground/launch identity wins over status aggregation; children never own this icon.
      const ownForeground =
        foreground[row?.paneKey ?? ''] ??
        (paneForeground.length === 1 ? paneForeground[0]?.[1] : undefined)
      const agentType =
        (!ownForeground?.shellForeground ? ownForeground?.agent : undefined) ??
        tab.launchAgent ??
        row?.entry.agentType ??
        row?.agentType
      if (!agentType || agentType === 'unknown') {
        return []
      }
      return [
        {
          tab,
          agentType,
          state: settled ? 'done' : row?.entry.sessionBoundary ? 'idle' : (row?.state ?? 'idle'),
          stateStartedAt: row?.entry.stateStartedAt ?? tab.createdAt,
          paneKey: row?.paneKey,
          providerSessionId: row?.entry.providerSession?.id,
          taskTitle: workerTaskTitle(context),
          depth: 0
        }
      ]
    })
    .sort(
      (a, b) =>
        agentStateOrder(a.state) - agentStateOrder(b.state) || a.tab.sortOrder - b.tab.sortOrder
    )
  const byId = new Map(rows.map((row) => [row.tab.id, row]))
  // RA: children always follow their parent; disclosure state never filters live tabs.
  return orderAgentLineage(
    rows.map((row) => row.tab.id),
    parents
  ).map((id) => {
    const row = byId.get(id)!
    const seen = new Set([id])
    let parent = parents.get(id)
    let depth = 0
    while (parent && byId.has(parent) && !seen.has(parent)) {
      seen.add(parent)
      depth++
      parent = parents.get(parent)
    }
    return { ...row, depth: parent && seen.has(parent) ? 0 : depth }
  })
}

// Runtime taskTitle already derives from the first nonempty spec line; launch names are not task subjects.
export function workerTaskTitle(
  context: AgentStatusOrchestrationContext | undefined
): string | undefined {
  if (!context?.taskId) {
    return undefined
  }
  const title = [context.taskTitle, context.displayName].find(
    (value) => value?.trim() && !/^worker-task_/i.test(value.trim())
  )
  return title?.trim().split(/\r?\n/)[0] || context.taskId
}

export function agentStateOrder(state: AgentRowState): number {
  switch (state) {
    case 'waiting':
    case 'blocked':
      return 0
    case 'working':
      return 1
    case 'done':
      return 2
    case 'idle':
    case 'unverifiable':
      return 3
  }
}
