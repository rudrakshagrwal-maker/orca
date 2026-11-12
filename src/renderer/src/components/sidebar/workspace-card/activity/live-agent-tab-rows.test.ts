import { expect, it } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import type { TerminalTab } from '../../../../../../shared/workspace-layout/terminal-tab-types'
import { liveAgentTabRows, workerTaskTitle } from './live-agent-tab-rows'

const tab = (id: string, agent = true): TerminalTab => ({
  id,
  worktreeId: 'folder',
  ptyId: `pty-${id}`,
  title: `Terminal ${id}`,
  customTitle: null,
  color: null,
  sortOrder: 0,
  createdAt: 100,
  ...(agent ? { launchAgent: 'claude' as const } : {})
})
const row = (
  id: string,
  state: DashboardAgentRow['state'],
  rowSource: DashboardAgentRow['rowSource'] = 'live'
): DashboardAgentRow => ({
  tab: tab(id),
  paneKey: `${id}:pane`,
  agentType: 'claude',
  state,
  rowSource,
  startedAt: 100,
  entry: {
    paneKey: `${id}:pane`,
    state: state === 'idle' || state === 'unverifiable' ? 'done' : state,
    prompt: 'work',
    stateStartedAt: 200,
    updatedAt: 200,
    stateHistory: []
  }
})

// RA: the counted entities are tabs, regardless of status-source duplication or hook absence.
it('has exactly one row per live agent tab, including more than six and agents without hooks', () => {
  const tabs = ['1', '2', '3', '4', '5', '6', '7'].map((id) => tab(id))
  const rows = liveAgentTabRows(
    [...tabs, tab('shell', false), { ...tab('exited'), ptyId: null }],
    [
      row('1', 'working'),
      row('1', 'waiting'),
      row('ghost', 'done', 'retained'),
      row('1', 'working', 'subagent')
    ],
    {}
  )
  expect(rows.map((item) => item.tab.id)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
  expect(rows[0]?.state).toBe('waiting')
})

it('orders attention before working, done and idle, using each state clock', () => {
  const rows = liveAgentTabRows(
    ['idle', 'done', 'working', 'waiting'].map((id) => tab(id)),
    [row('done', 'done'), row('working', 'working'), row('waiting', 'waiting')],
    {}
  )
  expect(rows.map((item) => item.tab.id)).toEqual(['waiting', 'working', 'done', 'idle'])
  expect(rows[0]?.stateStartedAt).toBe(200)
  expect(rows[3]?.stateStartedAt).toBe(100)
})

it('drops a tab proven back at its shell and keeps a live structured session', () => {
  const exited = liveAgentTabRows(
    [tab('1')],
    [row('1', 'working')],
    {},
    { '1:11111111-1111-4111-8111-111111111111': { agent: null, shellForeground: true } }
  )
  expect(exited.map((item) => item.tab.id)).toEqual([])
  expect(
    liveAgentTabRows(
      [{ ...tab('chat'), ptyId: null }],
      [row('chat', 'working')],
      {},
      {},
      new Set(['chat'])
    ).map((item) => item.tab.id)
  ).toEqual(['chat'])
})

it('keeps children and grandchildren under their parent even when they need attention', () => {
  const rows = liveAgentTabRows(
    ['parent', 'other', 'child', 'grandchild'].map((id) => tab(id)),
    [row('child', 'waiting'), row('grandchild', 'working')],
    {},
    {},
    new Set(),
    new Map([
      ['child', 'parent'],
      ['grandchild', 'child']
    ])
  )
  expect(rows.map((item) => [item.tab.id, item.depth])).toEqual([
    ['parent', 0],
    ['child', 1],
    ['grandchild', 2],
    ['other', 0]
  ])
})

it('uses the parent terminal identity even when its status row names a child provider', () => {
  const parent: DashboardAgentRow = { ...row('parent', 'working'), agentType: 'codex' }
  parent.entry.agentType = 'codex'
  expect(liveAgentTabRows([tab('parent')], [parent], {})[0]?.agentType).toBe('claude')
  expect(
    liveAgentTabRows(
      [tab('parent')],
      [parent],
      {},
      {
        'parent:11111111-1111-4111-8111-111111111111': {
          agent: 'claude',
          agentEvidence: 'process-read',
          shellForeground: false
        }
      }
    )[0]?.agentType
  ).toBe('claude')
})

it('uses task subjects or the derived first spec line, then the task id', () => {
  expect(
    workerTaskTitle({ taskId: 'task_1', taskTitle: 'Fix routing', displayName: 'worker-task_1' })
  ).toBe('Fix routing')
  expect(workerTaskTitle({ taskId: 'task_2', taskTitle: 'Review the diff\nKeep it scoped' })).toBe(
    'Review the diff'
  )
  expect(workerTaskTitle({ taskId: 'task_3', displayName: 'worker-task_3' })).toBe('task_3')
})

it('keeps settled workers done while the tab exists and drops them only when it closes', () => {
  const contexts = {
    'worker:11111111-1111-4111-8111-111111111111': {
      taskId: 'task_1',
      dispatchStatus: 'completed' as const,
      taskTitle: 'Review'
    }
  }
  const open = { ...tab('worker'), ptyId: null }
  expect(
    liveAgentTabRows([open], [], {}, {}, new Set(), new Map(), contexts).map((item) => [
      item.tab.id,
      item.state
    ])
  ).toEqual([['worker', 'done']])
  expect(liveAgentTabRows([], [], {}, {}, new Set(), new Map(), contexts)).toEqual([])
})
