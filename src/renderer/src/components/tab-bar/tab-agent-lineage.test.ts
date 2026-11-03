import { describe, expect, it } from 'vitest'
import type { AppState } from '@/store/types'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { selectTabIsSubagent } from './tab-agent-lineage'

const childPane = makePaneKey('child', '22222222-2222-4222-8222-222222222222')
const parentPane = makePaneKey('parent', '33333333-3333-4333-8333-333333333333')
const childTab: TerminalTab = {
  id: 'child',
  worktreeId: 'folder-workspace',
  title: 'Codex',
  ptyId: null,
  customTitle: null,
  color: null,
  sortOrder: 0,
  createdAt: 0
}

function entry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    paneKey: childPane,
    state: 'working',
    prompt: '',
    updatedAt: 1,
    stateStartedAt: 1,
    stateHistory: [],
    terminalHandle: 'term-child',
    worktreeId: childTab.worktreeId,
    ...overrides
  }
}

function state(overrides: Partial<AppState> = {}): AppState {
  return {
    tabsByWorktree: { [childTab.worktreeId]: [childTab] },
    agentStatusByPaneKey: {},
    retainedAgentsByPaneKey: {},
    runtimeAgentOrchestrationByPaneKey: {},
    ...overrides
  } as AppState
}

// RA: Exercise real selectors for launch-only, retained and early runtime ancestry.
describe('subagent tab lineage', () => {
  it('recognizes a parent handle without a task, dispatch or mounted parent', () => {
    const current = state({
      agentStatusByPaneKey: {
        [childPane]: entry({ orchestration: { parentTerminalHandle: 'term-parent' } })
      }
    })
    expect(selectTabIsSubagent(current, childTab.worktreeId, 'child')).toBe(true)
    expect(selectTabIsSubagent(current, childTab.worktreeId, 'parent')).toBe(false)
    expect(selectTabIsSubagent(current, 'another-workspace', 'child')).toBe(false)
  })

  it('uses pushed runtime ancestry before the first agent status and reacts to its removal', () => {
    const current = state({
      runtimeAgentOrchestrationByPaneKey: { [childPane]: { parentPaneKey: parentPane } }
    })
    expect(selectTabIsSubagent(current, childTab.worktreeId, 'child')).toBe(true)
    expect(
      selectTabIsSubagent(
        { ...current, runtimeAgentOrchestrationByPaneKey: {} },
        childTab.worktreeId,
        'child'
      )
    ).toBe(false)
  })

  it('retains child sizing after completion, but a current root session supersedes retained ancestry', () => {
    const current = state({
      retainedAgentsByPaneKey: {
        [childPane]: {
          entry: entry({ state: 'done', orchestration: { coordinatorHandle: 'term-parent' } }),
          tab: childTab,
          worktreeId: childTab.worktreeId,
          agentType: 'codex',
          startedAt: 1
        }
      }
    })
    expect(selectTabIsSubagent(current, childTab.worktreeId, 'child')).toBe(true)
    expect(
      selectTabIsSubagent(
        { ...current, agentStatusByPaneKey: { [childPane]: entry() } },
        childTab.worktreeId,
        'child'
      )
    ).toBe(false)
  })

  it('rejects self ancestry and unrelated dispatch metadata', () => {
    const current = state({
      agentStatusByPaneKey: {
        [childPane]: entry({
          orchestration: {
            taskId: 'task',
            dispatchId: 'dispatch',
            parentPaneKey: childPane,
            parentTerminalHandle: 'term-child'
          }
        })
      }
    })
    expect(selectTabIsSubagent(current, childTab.worktreeId, 'child')).toBe(false)
  })
})
