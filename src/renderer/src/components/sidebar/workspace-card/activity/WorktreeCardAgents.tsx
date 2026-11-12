import { recomputeOn } from '@/lib/recompute-on'
import { useWorktreeAgentActivation } from './use-worktree-agent-activation'
import React, { useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store/index'
import DashboardAgentRow from '@/components/dashboard/DashboardAgentRow'
import { useNow } from '@/hooks/use-now'
import { deriveRunningAgentSendTargets } from '@/lib/agent-session/messaging/running-agent-targets'
import {
  selectSendTargetControlInputs,
  selectSendTargetInputs
} from './worktree-card-send-target-inputs'
import { useWorktreeAgentRows } from './useWorktreeAgentRows'
import { useWorktreeAgentDisplay } from './use-worktree-agent-display'
import { cn } from '@/lib/class-names'
import type { DashboardAgentRow as DashboardAgentRowData } from '@/components/dashboard/useDashboardData'
import { useFocusedAgentPaneKey } from './focused-agent-row-highlight'
import { buildSidebarAgentTree } from '../../sidebar-agent-tree'
import { selectVisibleAgentOrchestration } from '@/runtime/agent-orchestration/visible-agent-orchestration'
import { useTranslate } from '@/i18n/use-translate'
import { agentSendDisabledReasonLabel } from '@/lib/agent-session/messaging/agent-send-disabled-reason-label'
import { useUiLanguageRevision } from '@/i18n/use-ui-language-revision'
import { activateRetainedAgentRow } from './activate-retained-agent-row'
import { selectAgentRowsUnread } from './worktree-card-agent-ack-inputs'
import { WorktreeLiveAgentRows } from './WorktreeLiveAgentRows'

export const SUPPRESS_WORKTREE_LIST_SCROLL_ADJUSTMENT_EVENT =
  'orca-suppress-worktree-list-scroll-adjustment'

type Props = {
  worktreeId: string
  agents?: DashboardAgentRowData[]
  className?: string
}

const WorktreeCardAgents = React.memo(function WorktreeCardAgents({
  worktreeId,
  agents: precomputedAgents,
  className
}: Props) {
  useUiLanguageRevision()
  const selectedAgents = useWorktreeAgentRows(worktreeId, precomputedAgents === undefined)
  const agents = precomputedAgents ?? selectedAgents
  const picking = useAppStore((s) => s.agentSendPopoverTargetMode?.worktreeId === worktreeId)
  // RA: ordinary cards showcase every live tab; retain the existing target picker behavior.
  if (!picking) {
    return <WorktreeLiveAgentRows worktreeId={worktreeId} agents={agents} className={className} />
  }
  if (agents.length === 0) {
    return null
  }
  // Only non-empty bodies mount the 30s clock, avoiding timer cost for idle worktrees.
  return <WorktreeCardAgentsBody worktreeId={worktreeId} agents={agents} className={className} />
})

type BodyProps = {
  worktreeId: string
  agents: DashboardAgentRowData[]
  className?: string
}

const WorktreeCardAgentsBody = React.memo(function WorktreeCardAgentsBody({
  worktreeId,
  agents,
  className
}: BodyProps) {
  const t = useTranslate()
  const languageRevision = useUiLanguageRevision()
  const { showAgentModels } = useWorktreeAgentDisplay()
  const dropAgentStatus = useAppStore((s) => s.dropAgentStatus)
  const dismissRetainedAgent = useAppStore((s) => s.dismissRetainedAgent)
  const { targetMode: agentSendPopoverTargetMode, agentStatusEpoch } = useAppStore(
    useShallow((s) => selectSendTargetControlInputs(s, worktreeId))
  )
  const sendTargetInputs = useAppStore(useShallow((s) => selectSendTargetInputs(s, worktreeId)))
  const sendPromptToSidebarAgentTarget = useAppStore((s) => s.sendPromptToSidebarAgentTarget)
  const focusedAgentPaneKey = useFocusedAgentPaneKey(worktreeId)

  // Project global acknowledgement state onto this card’s rows to avoid rerenders from other worktrees.
  const agentRowsUnread = useAppStore(useShallow((s) => selectAgentRowsUnread(s, agents)))
  const unvisitedByPaneKey = useMemo(() => {
    const out: Record<string, boolean> = {}
    for (const [index, agent] of agents.entries()) {
      out[agent.paneKey] = agentRowsUnread[index] ?? false
    }
    return out
  }, [agents, agentRowsUnread])

  const handleDismissAgent = useCallback(
    (paneKey: string) => {
      dropAgentStatus(paneKey)
      dismissRetainedAgent(paneKey)
    },
    [dropAgentStatus, dismissRetainedAgent]
  )

  const isAgentSendTargetModeActive = agentSendPopoverTargetMode !== null
  const sendTargetsByPaneKey = useMemo(
    () =>
      recomputeOn([agentStatusEpoch, languageRevision], () => {
        if (!isAgentSendTargetModeActive) {
          return new Map<
            string,
            { status: 'eligible' | 'disabled' | 'sending'; disabledReason?: string }
          >()
        }

        return new Map(
          deriveRunningAgentSendTargets(sendTargetInputs, worktreeId).map((target) => [
            target.paneKey,
            agentSendPopoverTargetMode?.status === 'sending' &&
            agentSendPopoverTargetMode.sendingPaneKey === target.paneKey
              ? {
                  status: 'sending' as const,
                  disabledReason: t(
                    'auto.components.sidebar.WorktreeCardAgents.sendingTarget',
                    'Sending...'
                  )
                }
              : target.disabledReason
                ? {
                    status: target.status,
                    disabledReason: agentSendDisabledReasonLabel(target.disabledReason)
                  }
                : { status: target.status }
          ])
        )
      }),
    [
      // Freshness timers advance this epoch without replacing the status map.
      agentStatusEpoch,
      languageRevision,
      agentSendPopoverTargetMode?.sendingPaneKey,
      agentSendPopoverTargetMode?.status,
      isAgentSendTargetModeActive,
      sendTargetInputs,
      worktreeId,
      t
    ]
  )

  const handleSendTargetClick = useCallback(
    (paneKey: string) => {
      void sendPromptToSidebarAgentTarget(paneKey)
    },
    [sendPromptToSidebarAgentTarget]
  )

  const handleActivateAgentTab = useWorktreeAgentActivation(worktreeId)
  const handleActivateRetainedAgent = useCallback(
    (tabId: string, paneKey: string) => activateRetainedAgentRow(worktreeId, tabId, paneKey),
    [worktreeId]
  )

  const now = useNow(30_000)
  // RA: preserve missing ancestors and start order from the former Agents section.
  const treeInputs = useAppStore(
    useShallow((s) => ({
      tabsByWorktree: s.tabsByWorktree,
      contexts: selectVisibleAgentOrchestration(s)
    }))
  )
  const lineageTree = useMemo(
    // RA: unread emphasis is projected above; avoid a global status subscription per card.
    () =>
      buildSidebarAgentTree(
        agents,
        {
          ...treeInputs,
          agentStatusByPaneKey: {},
          retainedAgentsByPaneKey: {},
          acknowledgedAgentsByPaneKey: {}
        },
        treeInputs.contexts
      ),
    [agents, treeInputs]
  )
  const { rootRows: rootAgents, childrenByParentPaneKey } = lineageTree
  const hasLineage = childrenByParentPaneKey.size > 0
  const sendTargetFor = (paneKey: string) =>
    isAgentSendTargetModeActive
      ? (sendTargetsByPaneKey.get(paneKey) ?? {
          status: 'disabled' as const,
          disabledReason: t(
            'auto.components.sidebar.WorktreeCardAgents.agentUnavailable',
            'Agent is not available'
          )
        })
      : undefined
  const renderChildAgents = (
    childAgents: DashboardAgentRowData[],
    renderChild: (childAgent: DashboardAgentRowData, idleGroupExpanded: boolean) => React.ReactNode
  ): React.ReactNode => (
    // RA: do not regroup idle children; every depth stays in stable start order.
    <>
      {childAgents.map((child, index) => (
        <div key={child.paneKey} className="relative min-w-0">
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute -left-2 top-0 border-l border-[#3f3f46]',
              index === childAgents.length - 1 ? 'h-3.5' : 'bottom-0'
            )}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -left-2 top-3.5 w-2 border-t border-[#3f3f46]"
          />
          {renderChild(child, true)}
        </div>
      ))}
    </>
  )

  const stopBubble = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  const renderAgentBranch = (
    agent: DashboardAgentRowData,
    ancestorPaneKeys: ReadonlySet<string> = new Set()
  ): React.ReactNode => {
    if (ancestorPaneKeys.has(agent.paneKey)) {
      // External lineage metadata may cycle; reject repeated ancestors before recursion.
      return null
    }
    const childAgents = childrenByParentPaneKey.get(agent.paneKey) ?? []
    const hasChildAgents = childAgents.length > 0
    const sendTarget = sendTargetFor(agent.paneKey)
    const descendantAncestorPaneKeys = new Set(ancestorPaneKeys)
    descendantAncestorPaneKeys.add(agent.paneKey)
    return (
      <React.Fragment key={agent.paneKey}>
        <DashboardAgentRow
          agent={agent}
          // RA: reuse the plain title/status/time row except in the send-target picker.
          sidebarTreeRow={!isAgentSendTargetModeActive}
          activationDisabled={lineageTree.closedParentPaneKeys.has(agent.paneKey)}
          showModel={showAgentModels}
          onDismiss={handleDismissAgent}
          onActivate={
            agent.rowSource === 'retained' ? handleActivateRetainedAgent : handleActivateAgentTab
          }
          now={now}
          // Keep rows bold until visiting the tab auto-acknowledges attention.
          isUnvisited={unvisitedByPaneKey[agent.paneKey] ?? false}
          // Use the smaller dot so dense inline rows do not read it as a second identity icon.
          stateDotSize="sm"
          // Row clicks already navigate to the agent, so a second expand glyph is redundant.
          hideExpand
          isFocusedPane={agent.paneKey === focusedAgentPaneKey}
          sendTargetStatus={sendTarget?.status}
          sendTargetDisabledReason={sendTarget?.disabledReason}
          onSendTargetClick={isAgentSendTargetModeActive ? handleSendTargetClick : undefined}
        />
        {hasChildAgents ? (
          <div className="ml-3 pl-2">
            {renderChildAgents(childAgents, (childAgent) =>
              renderAgentBranch(childAgent, descendantAncestorPaneKeys)
            )}
          </div>
        ) : null}
      </React.Fragment>
    )
  }

  return (
    // Gutter clicks must not bubble into card activation or metadata editing.
    <div
      className={cn('flex flex-col mt-1', className)}
      onClick={stopBubble}
      onDoubleClick={stopBubble}
      onMouseDown={stopBubble}
      onPointerDown={stopBubble}
      role={hasLineage ? 'tree' : 'group'}
      aria-label={t('auto.components.sidebar.WorktreeCardAgents.1b0a156717', 'Agents')}
    >
      {rootAgents.map((rootAgent) => renderAgentBranch(rootAgent))}
    </div>
  )
})

export default WorktreeCardAgents
