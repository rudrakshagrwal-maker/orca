import { describe, expect, it } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { buildSidebarAgentTree } from './sidebar-agent-tree'

function agent(
  id: string,
  state: DashboardAgentRow['state'],
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
      state: state === 'idle' || state === 'unverifiable' ? 'done' : state,
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
    // RA: folded counts cover the whole subtree at every depth.
    expect(result.descendantCounts.get(parent.paneKey)).toBe(2)
    expect(result.descendantCounts.get(child.paneKey)).toBe(1)
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

  it('keeps a missing-parent worker nested under a dim placeholder and a cycle visible', () => {
    const orphan = agent('orphan', 'working', 'missing')
    const first = agent('first', 'blocked', 'second')
    const second = agent('second', 'working', 'first')
    const result = tree([orphan, first, second])
    expect(result.rootRows.map((row) => row.paneKey)).toEqual(['closed-parent:missing', first.paneKey, second.paneKey])
    expect(result.childrenByParentPaneKey.get('closed-parent:missing')).toEqual([orphan])
    expect(result.closedParentPaneKeys.has('closed-parent:missing')).toBe(true)
  })

  // RA: all lifecycle states share one stable tree, including after a parent's turn ends.
  it.each(['working', 'done', 'idle', 'blocked', 'waiting'] as const)('keeps a %s helper under a finished parent', (state) => {
    const parent = agent('parent', 'done')
    const child = agent('child', state, 'parent')
    expect(tree([parent, child]).rootRows).toEqual([parent])
    expect(tree([parent, child]).childrenByParentPaneKey.get(parent.paneKey)).toEqual([child])
  })

  it('keeps three orchestrators and their helpers separate, including a nested orchestrator', () => {
    const roots = ['a', 'b', 'c'].map((id) => agent(id, 'idle'))
    const children = roots.flatMap((root) => [agent(`${root.tab.id}-1`, 'working', root.tab.id),
      agent(`${root.tab.id}-2`, 'done', root.tab.id)])
    const grandchild = agent('nested', 'blocked', 'b-1')
    const result = tree([...roots, ...children, grandchild])
    expect(result.rootRows).toEqual(roots)
    for (const root of roots) {
      expect(result.childrenByParentPaneKey.get(root.paneKey)).toHaveLength(2)
    }
    expect(result.childrenByParentPaneKey.get('b-1:pane')).toEqual([grandchild])
    expect(result.descendantStates.get('b:pane')).toBe('blocked')
    expect(result.descendantStates.get('b-1:pane')).toBe('blocked')
  })

  it('bubbles OSC-only permission prompts without masking a parent permission', () => {
    const parent = agent('parent', 'working')
    const child = agent('child', 'working', 'parent')
    child.entry.programStatus = { state: 'blocked', kind: 'permission', observedAt: 1_000 }
    expect(tree([parent, child]).descendantStates.get(parent.paneKey)).toBe('permission')
    parent.entry.programStatus = child.entry.programStatus
    child.entry.programStatus = undefined
    expect(tree([parent, child]).descendantStates.get(parent.paneKey)).toBe('permission')
  })

  it('includes completed helpers when aggregating a quiet orchestrator', () => {
    const parent = agent('parent', 'idle')
    const child = agent('child', 'done', 'parent')
    expect(tree([parent, child]).descendantStates.get(parent.paneKey)).toBe('done')
  })

  it('restores several closed ancestors from main-owned lineage after restart', () => {
    const child = agent('child', 'working')
    child.entry.orchestration = { parentPaneKey: 'middle:pane', parentTitle: 'Middle task' }
    const result = buildSidebarAgentTree([child], {
      agentStatusByPaneKey: { [child.paneKey]: child.entry },
      retainedAgentsByPaneKey: {}, acknowledgedAgentsByPaneKey: {}
    }, { 'middle:pane': { parentPaneKey: 'parent:pane', parentTitle: 'Parent task' } })
    expect(result.rootRows.map((row) => row.paneKey)).toEqual(['parent:pane'])
    expect(result.childrenByParentPaneKey.get('parent:pane')?.[0].paneKey).toBe('middle:pane')
    expect(result.childrenByParentPaneKey.get('middle:pane')).toEqual([child])
    expect([...result.closedParentPaneKeys].sort()).toEqual(['middle:pane', 'parent:pane'])
  })
})
