import { defineFixture } from '../../../../component-fixtures/component-fixture'
import WorktreeCardAgents from './WorktreeCardAgents'
import { buildWorktreeAgentRows } from './worktree-agent-rows'
import type { AgentStatusEntry } from '../../../../../../shared/agent-status/contracts/agent-status-types'
import type { AgentChildWorkView } from '../../../../../../shared/agent-status/child-work/agent-status-child-work-view'
import type { TerminalTab } from '../../../../../../shared/workspace-layout/terminal-tab-types'

const now = Date.now()
const HOUR = 3_600_000
const LEAF = '11111111-1111-4111-8111-111111111111'

function child(
  id: string,
  name: string,
  state: AgentChildWorkView['state'],
  startedAgo: number
): AgentChildWorkView {
  return {
    id,
    providerId: `task-${id}`,
    kind: 'agent',
    name,
    agentType: 'general-purpose',
    state,
    membership: 'live',
    ...(state === 'working'
      ? {
          operation: {
            toolName: 'Read',
            input: 'src/plugins/manifest.ts',
            basis: 'open' as const,
            observedAt: now
          }
        }
      : {}),
    firstObservedAt: now - startedAgo,
    observedAt: now,
    stoppable: true,
    invocation: { invocationId: `spawn-${id}`, generation: 1 }
  }
}

function rowsFor(worktreeId: string) {
  const tab: TerminalTab = {
    id: `${worktreeId}-tab`,
    ptyId: null,
    worktreeId,
    title: 'Claude',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: now
  }
  const parent: AgentStatusEntry = {
    paneKey: `${tab.id}:${LEAF}`,
    worktreeId,
    tabId: tab.id,
    agentType: 'claude',
    state: 'working',
    prompt: 'Orca plugin architecture review',
    updatedAt: now,
    stateStartedAt: now - 5 * HOUR,
    stateHistory: [],
    children: [
      child('a', 'plugin-dx', 'idle', 4 * HOUR),
      child('b', 'declarative-ui', 'idle', 3 * HOUR),
      child('c', 'sandbox-model', 'idle', 3 * HOUR),
      child('d', 'manifest-schema', 'working', 0.2 * HOUR)
    ]
  }
  return buildWorktreeAgentRows({ tabs: [tab], entries: [parent], retained: [], now })
}

function render(worktreeId: string) {
  return (
    <div className="flex flex-col gap-0.5 bg-sidebar p-2 text-sidebar-foreground">
      <WorktreeCardAgents worktreeId={worktreeId} agents={rowsFor(worktreeId)} />
    </div>
  )
}

export const atRest = defineFixture({
  width: 300,
  store: { agentActivityDisplayMode: 'compact' },
  render: () => render('fixture-subagents-rest')
})

export const userExpanded = defineFixture({
  width: 300,
  store: { agentActivityDisplayMode: 'compact' },
  render: () => render('fixture-subagents-expanded')
})

export const idleGroupExpanded = defineFixture({
  width: 300,
  store: { agentActivityDisplayMode: 'compact' },
  render: () => render('fixture-subagents-idle-open')
})

export const fullMode = defineFixture({
  width: 300,
  store: { agentActivityDisplayMode: 'full' },
  render: () => render('fixture-subagents-full')
})

export const fullModeCollapsed = defineFixture({
  width: 300,
  store: { agentActivityDisplayMode: 'full' },
  render: () => render('fixture-subagents-full-rest')
})
