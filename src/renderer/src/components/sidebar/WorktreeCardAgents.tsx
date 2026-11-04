import { useWorktreeAgentActivation } from './use-worktree-agent-activation'
import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import DashboardAgentRow from '@/components/dashboard/DashboardAgentRow'
import { useNow } from '@/hooks/use-now'
import { deriveRunningAgentSendTargets } from '@/lib/running-agent-targets'
import {
  selectSendTargetControlInputs,
  selectSendTargetInputs
} from './worktree-card-send-target-inputs'
import { useWorktreeAgentRows } from './useWorktreeAgentRows'
import { useWorktreeAgentDisplay } from './use-worktree-agent-display'
import { cn } from '@/lib/utils'
import type { DashboardAgentRow as DashboardAgentRowData } from '@/components/dashboard/useDashboardData'
import { useFocusedAgentPaneKey } from './focused-agent-row-highlight'
import {
  CompactAgentExpansion,
  CompactAgentRow,
  CompactAgentSummaryButton
} from './worktree-card-compact-agents'
import { buildSidebarAgentTree } from './sidebar-agent-tree' // RA: one shared lineage builder.
import { selectVisibleAgentOrchestration } from '@/runtime/visible-agent-orchestration'
import { revealCompactAgentCard } from './worktree-sidebar-reveal'
import { useWorktreeAgentExpansionState } from './worktree-card-agents-expansion-state'
import { translate } from '@/i18n/i18n'
import { agentSendDisabledReasonLabel } from '@/lib/agent-send-disabled-reason-label'
import { useUiLanguageRevision } from '@/i18n/use-ui-language-revision'
import { activateRetainedAgentRow } from './activate-retained-agent-row'
import { selectAgentRowsUnread } from './worktree-card-agent-ack-inputs'
import { opensClaudeParentConversation } from '@/lib/claude-agent-row-view'
import { lineageAncestorPaneKeys } from './worktree-card-agent-lineage-disclosure'

export const SUPPRESS_WORKTREE_LIST_SCROLL_ADJUSTMENT_EVENT =
  'orca-suppress-worktree-list-scroll-adjustment'

const dispatchSuppressScrollAdjustment = () => {
  window.dispatchEvent(new CustomEvent(SUPPRESS_WORKTREE_LIST_SCROLL_ADJUSTMENT_EVENT))
}

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
  const languageRevision = useUiLanguageRevision()
  const { agentActivityDisplayMode, showAgentModels } = useWorktreeAgentDisplay()
  const dropAgentStatus = useAppStore((s) => s.dropAgentStatus)
  const dismissRetainedAgent = useAppStore((s) => s.dismissRetainedAgent)
  const { targetMode: agentSendPopoverTargetMode, agentStatusEpoch } = useAppStore(
    useShallow((s) => selectSendTargetControlInputs(s, worktreeId))
  )
  const sendTargetInputs = useAppStore(useShallow((s) => selectSendTargetInputs(s, worktreeId)))
  const sendPromptToSidebarAgentTarget = useAppStore((s) => s.sendPromptToSidebarAgentTarget)
  const focusedAgentPaneKey = useFocusedAgentPaneKey(worktreeId)
  const compactAgentListRootRef = useRef<HTMLDivElement | null>(null)

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
  const sendTargetsByPaneKey = useMemo(() => {
    void agentStatusEpoch
    void languageRevision
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
              disabledReason: translate(
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
  }, [
    // Freshness timers advance this epoch without replacing the status map.
    agentStatusEpoch,
    languageRevision,
    agentSendPopoverTargetMode?.sendingPaneKey,
    agentSendPopoverTargetMode?.status,
    isAgentSendTargetModeActive,
    sendTargetInputs,
    worktreeId
  ])

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
  const treeInputs = useAppStore(useShallow((s) => ({
    tabsByWorktree: s.tabsByWorktree,
    contexts: selectVisibleAgentOrchestration(s)
  })))
  const lineageTree = useMemo(
    // RA: unread emphasis is projected above; avoid a global status subscription per card.
    () => buildSidebarAgentTree(agents, {
      ...treeInputs, agentStatusByPaneKey: {}, retainedAgentsByPaneKey: {}, acknowledgedAgentsByPaneKey: {}
    }, treeInputs.contexts),
    [agents, treeInputs]
  )
  const { rootRows: rootAgents, childrenByParentPaneKey } = lineageTree
  const hasLineage = childrenByParentPaneKey.size > 0
  const collapsedChildAgentSignalStates = lineageTree.descendantStates
  // Persist disclosure outside component state so virtualizer/sibling-triggered remounts cannot reset it.
  const {
    expandedLineageParents,
    compactRootListExpanded,
    toggleLineageParent: toggleLineageParentState,
    toggleCompactRootList
  } = useWorktreeAgentExpansionState(worktreeId)

  // Reveal only user expansion; restoring cached expansion on remount must not scroll again.
  const previousCompactExpandedRef = useRef(compactRootListExpanded)
  useLayoutEffect(() => {
    const wasExpanded = previousCompactExpandedRef.current
    previousCompactExpandedRef.current = compactRootListExpanded
    if (!wasExpanded && compactRootListExpanded && agentActivityDisplayMode === 'compact') {
      dispatchSuppressScrollAdjustment()
      // Defer reveal one frame to avoid synchronous sidebar layout during the opening animation.
      const handle = requestAnimationFrame(() => {
        revealCompactAgentCard(compactAgentListRootRef.current)
      })
      return () => cancelAnimationFrame(handle)
    }
    return undefined
  }, [agentActivityDisplayMode, compactRootListExpanded])
  const toggleLineageParent = useCallback(
    (paneKey: string) => {
      dispatchSuppressScrollAdjustment()
      toggleLineageParentState(paneKey)
    },
    [toggleLineageParentState]
  )

  const sendTargetFor = (paneKey: string) =>
    isAgentSendTargetModeActive
      ? (sendTargetsByPaneKey.get(paneKey) ?? {
          status: 'disabled' as const,
          disabledReason: translate(
            'auto.components.sidebar.WorktreeCardAgents.agentUnavailable',
            'Agent is not available'
          )
        })
      : undefined
  // Picker rows are the send targets, so every lineage level stays open while picking.
  const isLineageExpanded = (paneKey: string): boolean =>
    isAgentSendTargetModeActive || expandedLineageParents.has(paneKey)
  const focusedAncestorPaneKeys = useMemo(
    () => lineageAncestorPaneKeys(childrenByParentPaneKey, focusedAgentPaneKey),
    [childrenByParentPaneKey, focusedAgentPaneKey]
  )
  // A collapsed parent stands in for its hidden focused descendant.
  const isFocusedOrHidesFocus = (paneKey: string, expanded: boolean): boolean =>
    paneKey === focusedAgentPaneKey || (!expanded && focusedAncestorPaneKeys.has(paneKey))

  const renderChildAgents = (
    childAgents: DashboardAgentRowData[],
    renderChild: (childAgent: DashboardAgentRowData, idleGroupExpanded: boolean) => React.ReactNode
  ): React.ReactNode => (
    // RA: do not regroup idle children; every depth stays in stable start order.
    <>{childAgents.map((child, index) => (
      <div key={child.paneKey} className="relative min-w-0">
        <span aria-hidden className={cn(
          'pointer-events-none absolute -left-2 top-0 border-l border-[#3f3f46]',
          index === childAgents.length - 1 ? 'h-3.5' : 'bottom-0'
        )} />
        <span aria-hidden className="pointer-events-none absolute -left-2 top-3.5 w-2 border-t border-[#3f3f46]" />
        {renderChild(child, true)}
      </div>
    ))}</>
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
    const expanded = isLineageExpanded(agent.paneKey)
    // Picker mode forces children open; a toggle there would silently flip stored state.
    const canToggle = hasChildAgents && !isAgentSendTargetModeActive
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
          childAgentCount={lineageTree.descendantCounts.get(agent.paneKey)}
          childAgentsExpanded={expanded}
          collapsedChildAgentsState={
            hasChildAgents
              ? collapsedChildAgentSignalStates.get(agent.paneKey)
              : undefined
          }
          onToggleChildAgents={canToggle ? () => toggleLineageParent(agent.paneKey) : undefined}
          isFocusedPane={isFocusedOrHidesFocus(agent.paneKey, expanded)}
          sendTargetStatus={sendTarget?.status}
          sendTargetDisabledReason={sendTarget?.disabledReason}
          onSendTargetClick={isAgentSendTargetModeActive ? handleSendTargetClick : undefined}
        />
        {hasChildAgents && expanded ? (
          <div className="ml-3 pl-2">
            {renderChildAgents(childAgents, (childAgent) =>
              renderAgentBranch(childAgent, descendantAncestorPaneKeys)
            )}
          </div>
        ) : null}
      </React.Fragment>
    )
  }

  const renderCompactAgentBranch = (
    agent: DashboardAgentRowData,
    ancestorPaneKeys: ReadonlySet<string> = new Set(),
    cacheTimerActive = true
  ): React.ReactNode => {
    if (ancestorPaneKeys.has(agent.paneKey)) {
      return null
    }
    const childAgents = childrenByParentPaneKey.get(agent.paneKey) ?? []
    const hasChildAgents = childAgents.length > 0
    const expanded = isLineageExpanded(agent.paneKey)
    // Picker mode forces children open; a toggle there would silently flip stored state.
    const canToggle = hasChildAgents && !isAgentSendTargetModeActive
    const sendTarget = sendTargetFor(agent.paneKey)
    const descendantAncestorPaneKeys = new Set(ancestorPaneKeys)
    descendantAncestorPaneKeys.add(agent.paneKey)
    return (
      <div key={agent.paneKey} className="min-w-0">
        <CompactAgentRow
          agent={agent}
          // RA: a closed ancestor must never activate a surviving child's tab.
          activationDisabled={lineageTree.closedParentPaneKeys.has(agent.paneKey)}
          showModel={showAgentModels}
          now={now}
          parentConversationDescription={
            opensClaudeParentConversation(agent)
              ? translate(
                  'auto.lib.claudeAgentRowView.openParentConversation',
                  'Open parent conversation'
                )
              : undefined
          }
          isUnvisited={unvisitedByPaneKey[agent.paneKey] ?? false}
          onActivate={
            agent.rowSource === 'retained' ? handleActivateRetainedAgent : handleActivateAgentTab
          }
          sendTargetStatus={sendTarget?.status}
          sendTargetDisabledReason={sendTarget?.disabledReason}
          onSendTargetClick={isAgentSendTargetModeActive ? handleSendTargetClick : undefined}
          childAgentCount={lineageTree.descendantCounts.get(agent.paneKey)}
          childAgentsExpanded={expanded}
          collapsedChildAgentsState={
            hasChildAgents
              ? collapsedChildAgentSignalStates.get(agent.paneKey)
              : undefined
          }
          onToggleChildAgents={canToggle ? () => toggleLineageParent(agent.paneKey) : undefined}
          isFocusedPane={isFocusedOrHidesFocus(agent.paneKey, expanded)}
          cacheTimerActive={cacheTimerActive}
        />
        {hasChildAgents ? (
          <CompactAgentExpansion expanded={expanded}>
            <div className="ml-3 flex flex-col gap-0.5 pl-2">
              {renderChildAgents(childAgents, (childAgent, idleGroupExpanded) =>
                renderCompactAgentBranch(
                  childAgent,
                  descendantAncestorPaneKeys,
                  cacheTimerActive && expanded && idleGroupExpanded
                )
              )}
            </div>
          </CompactAgentExpansion>
        ) : null}
      </div>
    )
  }

  if (agentActivityDisplayMode === 'compact') {
    const summaryAgents = agents // RA: the count and status summary include every child.
    // Collapse compact multi-agent lists except when their rows are the send-target picker.
    const shouldUseSummaryRow = rootAgents.length > 1 && !isAgentSendTargetModeActive
    const subjectLabel = translate('sidebar.agentSummary.agentCount', '{{count}} agents', {
      count: agents.length,
      defaultValue_one: '{{count}} agent'
    })

    return (
      <div
        ref={compactAgentListRootRef}
        className={cn('flex flex-col mt-1 gap-0.5', className)}
        onClick={stopBubble}
        onDoubleClick={stopBubble}
        onMouseDown={stopBubble}
        onPointerDown={stopBubble}
        role={hasLineage ? 'tree' : 'group'}
        aria-label={translate('auto.components.sidebar.WorktreeCardAgents.1b0a156717', 'Agents')}
        data-compact-agent-list="true"
      >
        {agents.length === 0 ? null : shouldUseSummaryRow ? (
          <div
            className={cn(
              'compact-agent-summary-panel',
              compactRootListExpanded && 'compact-agent-summary-panel-expanded'
            )}
          >
            <CompactAgentSummaryButton
              agents={summaryAgents}
              subjectLabel={subjectLabel}
              expanded={compactRootListExpanded}
              onToggle={() => {
                dispatchSuppressScrollAdjustment()
                toggleCompactRootList()
              }}
            />
            <CompactAgentExpansion expanded={compactRootListExpanded}>
              {rootAgents.map((rootAgent) =>
                renderCompactAgentBranch(rootAgent, new Set(), compactRootListExpanded)
              )}
            </CompactAgentExpansion>
          </div>
        ) : (
          rootAgents.map((rootAgent) => renderCompactAgentBranch(rootAgent))
        )}
      </div>
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
      aria-label={translate('auto.components.sidebar.WorktreeCardAgents.1b0a156717', 'Agents')}
    >
      {rootAgents.map((rootAgent) => renderAgentBranch(rootAgent))}
    </div>
  )
})

export default WorktreeCardAgents
