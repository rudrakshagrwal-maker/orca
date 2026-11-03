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

// RA: status and acknowledgement changes cannot regroup or reorder the hierarchy.
describe('sidebar agent tree', () => {
  it('nests a multilevel tree across workspace boundaries without repeating children', () => {
    const parent = agent('parent', 'done')
    const child = agent('child', 'working', 'parent')
    const grandchild = agent('grandchild', 'blocked', 'child')
    const result = tree([child, grandchild, parent])

    expect(result.rootRows).toEqual([parent])
    expect(result.childrenByParentPaneKey.get(parent.paneKey)).toEqual([child])
    expect(result.childrenByParentPaneKey.get(child.paneKey)).toEqual([grandchild])
    expect(result).not.toHaveProperty('groups')
  })

  it('orders roots and siblings by session start, independent of input and status', () => {
    const question = agent('question', 'waiting')
    const parent = agent('parent', 'done')
    const child = agent('child', 'working', 'parent')
    const olderChild = agent('older-child', 'done', 'parent')
    parent.startedAt = 100
    question.startedAt = 200
    olderChild.startedAt = 300
    child.startedAt = 400
    const rows = [child, question, olderChild, parent]
    const result = tree(rows)

    expect(result.rootRows).toEqual([parent, question])
    expect(result.childrenByParentPaneKey.get(parent.paneKey)).toEqual([olderChild, child])
    child.entry.state = child.state = 'blocked'
    child.entry.stateStartedAt = 90_000
    parent.entry.state = parent.state = 'working'
    expect(tree([...rows].reverse()).rootRows).toEqual([parent, question])
    expect(tree(rows).childrenByParentPaneKey.get(parent.paneKey)).toEqual([olderChild, child])
  })

  it('keeps acknowledged completions in place and clears only their unread emphasis', () => {
    const done = agent('done', 'done')
    expect(tree([done]).rootRows).toEqual([done])
    const visited = tree([done], { [done.paneKey]: done.entry.stateStartedAt })
    expect(visited.rootRows).toEqual([done])
    expect(visited.unvisitedPaneKeys.size).toBe(0)
  })

  it('keeps a missing-parent worker and a closed cycle visible', () => {
    const orphan = agent('orphan', 'working', 'missing')
    const first = agent('first', 'blocked', 'second')
    const second = agent('second', 'working', 'first')
    const result = tree([orphan, first, second])
    expect(result.rootRows).toEqual([orphan, first, second])
    expect(result.childrenByParentPaneKey.size).toBe(0)
  })
})
