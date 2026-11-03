import { describe, expect, it } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { buildSidebarAgentTree } from './sidebar-agent-tree'

function agent(
  id: string,
  state: DashboardAgentRow['entry']['state'],
  parent?: string
): DashboardAgentRow {
  return {
    paneKey: `${id}:pane`,
    agentType: 'codex',
    state,
    startedAt: 1_000,
    entry: {
      paneKey: `${id}:pane`,
      terminalHandle: id,
      state,
      prompt: id,
      updatedAt: 2_000,
      stateStartedAt: 1_000,
      stateHistory: [],
      ...(parent
        ? { orchestration: { taskId: id, dispatchId: id, parentTerminalHandle: parent } }
        : {})
    },
    tab: {
      id,
      worktreeId: `workspace-${id}`,
      title: id,
      customTitle: null,
      color: null,
      ptyId: null,
      sortOrder: 0,
      createdAt: 1_000
    }
  }
}

function tree(rows: DashboardAgentRow[], acknowledgedAgentsByPaneKey = {}) {
  return buildSidebarAgentTree(rows, {
    agentStatusByPaneKey: Object.fromEntries(rows.map((row) => [row.paneKey, row.entry])),
    retainedAgentsByPaneKey: {},
    acknowledgedAgentsByPaneKey
  })
}

// RA: exercise fleet urgency across workspace boundaries and acknowledgement changes.
describe('sidebar agent tree', () => {
  it('moves an entire multilevel tree to Needs you without repeating its children', () => {
    const parent = agent('parent', 'done')
    const child = agent('child', 'working', 'parent')
    const grandchild = agent('grandchild', 'blocked', 'child')
    const result = tree([child, grandchild, parent])

    expect(result.groups.get('attention')).toEqual([parent])
    expect(result.rootRows).toEqual([parent])
    expect(result.childrenByParentPaneKey.get(parent.paneKey)).toEqual([child])
    expect(result.childrenByParentPaneKey.get(child.paneKey)).toEqual([grandchild])
    expect(result.groups.get('working')).toEqual([])
    expect(result.groups.get('done')).toEqual([])
  })

  it('groups a question as Needs you and working children ahead of completed parents', () => {
    const question = agent('question', 'waiting')
    const parent = agent('parent', 'done')
    const child = agent('child', 'working', 'parent')
    const result = tree([parent, child, question])

    expect(result.groups.get('attention')).toEqual([question])
    expect(result.groups.get('working')).toEqual([parent])
  })

  it('moves a completion from Done to Idle once its turn is acknowledged', () => {
    const done = agent('done', 'done')
    expect(tree([done]).groups.get('done')).toEqual([done])
    const visited = tree([done], { [done.paneKey]: done.entry.stateStartedAt })
    expect(visited.groups.get('done')).toEqual([])
    expect(visited.groups.get('idle')).toEqual([done])
    expect(visited.unvisitedPaneKeys.size).toBe(0)
  })

  it('keeps a missing-parent worker and a closed cycle visible', () => {
    const orphan = agent('orphan', 'working', 'missing')
    const first = agent('first', 'blocked', 'second')
    const second = agent('second', 'working', 'first')
    const result = tree([orphan, first, second])
    expect(result.rootRows).toEqual([orphan, first, second])
    expect(result.groups.get('attention')).toEqual([first])
    expect(result.groups.get('working')).toEqual([orphan, second])
  })
})
