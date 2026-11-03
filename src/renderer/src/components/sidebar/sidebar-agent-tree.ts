import { buildAgentRowLineageTree } from '@/components/dashboard/agent-row-lineage-model'
import {
  dashboardRowBucketProjection,
  type AgentRowUnreadState,
  readAgentRowTurnRecords
} from '@/components/dashboard/dashboard-row-bucket'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'

// RA: start order is independent of status, turn timestamps and acknowledgements.
export function buildSidebarAgentTree(rows: DashboardAgentRow[], state: AgentRowUnreadState) {
  const tree = buildAgentRowLineageTree(
    [...rows].sort((a, b) =>
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
  return { ...tree, unvisitedPaneKeys }
}
