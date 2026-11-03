import { buildAgentRowLineageTree } from '@/components/dashboard/agent-row-lineage-model'
import {
  dashboardRowBucketProjection,
  type AgentRowUnreadState,
  readAgentRowTurnRecords
} from '@/components/dashboard/dashboard-row-bucket'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import type { AgentStatusOrchestrationContext } from '../../../../shared/agent-status-types'
import { buildCollapsedChildAgentSignalStates } from './worktree-card-idle-child-agents'
import { getAgentDotState, SUMMARY_STATE_ORDER } from './worktree-card-agent-summary'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { parsePaneKey } from '../../../../shared/stable-pane-id'

// RA: start order is independent of status, turn timestamps and acknowledgements.
export function buildSidebarAgentTree(
  rows: DashboardAgentRow[],
  state: AgentRowUnreadState & { tabsByWorktree?: Record<string, TerminalTab[]> },
  contexts: Record<string, AgentStatusOrchestrationContext> = {}
) {
  // RA: missing parents get a dim placeholder, never a promoted child.
  const allRows = [...rows]
  const byPane = new Map(rows.map((row) => [row.paneKey, row]))
  const byHandle = new Map(
    rows.filter((row) => row.entry.terminalHandle).map((row) => [row.entry.terminalHandle!, row])
  )
  const closedParentPaneKeys = new Set<string>()
  const tabsById = new Map(Object.values(state.tabsByWorktree ?? {}).flat().map((tab) => [tab.id, tab]))
  for (const row of allRows) {
    const context = row.entry.orchestration
    const handle = context?.parentTerminalHandle || context?.coordinatorHandle
    const parentKey =
      context?.parentPaneKey ||
      (handle ? (byHandle.get(handle)?.paneKey ?? `closed-parent:${handle}`) : undefined)
    if (!parentKey || parentKey === row.paneKey || byPane.has(parentKey)) {
      continue
    }
    const tab = tabsById.get(parsePaneKey(parentKey)?.tabId ?? '')
    const title =
      tab?.customTitle?.trim() || tab?.title.trim() || context?.parentTitle?.trim() || handle || 'Agent'
    const parent: DashboardAgentRow = {
      ...row,
      paneKey: parentKey,
      state: 'idle',
      rowSource: 'live',
      startedAt: tab?.createdAt ?? row.startedAt,
      tab: tab ?? { ...row.tab, title, customTitle: null },
      activationPaneKey: undefined,
      childRow: undefined,
      entry: {
        paneKey: parentKey,
        terminalHandle: handle,
        state: 'done', // RA: idle is a derived row state, never a wire status.
        prompt: '',
        updatedAt: row.entry.updatedAt,
        stateStartedAt: row.entry.stateStartedAt,
        stateHistory: [],
        orchestration: contexts[parentKey]
      }
    }
    // RA: a parent awaiting status hydration is still a live, focusable tab.
    if (!tab) {
      closedParentPaneKeys.add(parentKey)
    }
    byPane.set(parentKey, parent)
    if (handle) {
      byHandle.set(handle, parent)
    }
    allRows.push(parent)
  }
  const tree = buildAgentRowLineageTree(
    allRows.sort(
      (a, b) =>
        (a.startedAt || a.tab.createdAt) - (b.startedAt || b.tab.createdAt) ||
        a.paneKey.localeCompare(b.paneKey)
    )
  )
  const records = readAgentRowTurnRecords(state)
  const unvisitedPaneKeys = new Set<string>()
  for (const row of rows) {
    const { unseen } = dashboardRowBucketProjection(row, records)
    if (unseen) {
      unvisitedPaneKeys.add(row.paneKey)
    }
  }
  // RA: combine parent and descendant urgency without masking a parent's own permission prompt.
  const descendantStates = new Map(
    buildCollapsedChildAgentSignalStates(tree.childrenByParentPaneKey, true)
  )
  for (const row of allRows) {
    const own = getAgentDotState(row)
    const child = descendantStates.get(row.paneKey)
    if (child && SUMMARY_STATE_ORDER.indexOf(own) < SUMMARY_STATE_ORDER.indexOf(child)) {
      descendantStates.set(row.paneKey, own)
    }
  }
  return {
    ...tree,
    unvisitedPaneKeys,
    closedParentPaneKeys,
    // RA: share the existing descendant urgency projection, including nested orchestrators.
    descendantStates
  }
}
