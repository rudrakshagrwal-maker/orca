import { buildAgentRowLineageTree } from '@/components/dashboard/agent-row-lineage-model'
import {
  dashboardRowBucketProjection,
  type AgentRowUnreadState,
  readAgentRowTurnRecords
} from '@/components/dashboard/dashboard-row-bucket'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'

export const SIDEBAR_AGENT_GROUPS = ['attention', 'working', 'done', 'idle'] as const
export type SidebarAgentGroup = (typeof SIDEBAR_AGENT_GROUPS)[number]

// RA: assign the whole tree to its most urgent member, including nested workers.
export function buildSidebarAgentTree(rows: DashboardAgentRow[], state: AgentRowUnreadState) {
  const tree = buildAgentRowLineageTree(rows)
  const records = readAgentRowTurnRecords(state)
  const groups = new Map<SidebarAgentGroup, DashboardAgentRow[]>(
    SIDEBAR_AGENT_GROUPS.map((group) => [group, []])
  )
  const unvisitedPaneKeys = new Set<string>()
  const priorityByPaneKey = new Map<string, number>()
  for (const row of rows) {
    const { bucket, unseen } = dashboardRowBucketProjection(row, records)
    priorityByPaneKey.set(row.paneKey, SIDEBAR_AGENT_GROUPS.indexOf(bucket))
    if (unseen) {
      unvisitedPaneKeys.add(row.paneKey)
    }
  }
  for (const root of tree.rootRows) {
    let priority = SIDEBAR_AGENT_GROUPS.length - 1
    const pending = [root]
    const visited = new Set<string>()
    for (const row of pending) {
      if (visited.has(row.paneKey)) {
        continue
      }
      visited.add(row.paneKey)
      priority = Math.min(priority, priorityByPaneKey.get(row.paneKey) ?? priority)
      pending.push(...(tree.childrenByParentPaneKey.get(row.paneKey) ?? []))
    }
    groups.get(SIDEBAR_AGENT_GROUPS[priority] ?? 'idle')?.push(root)
  }
  return { ...tree, groups, unvisitedPaneKeys }
}
