import { useMemo, useState } from 'react'
import { revealWorkerTab } from '@/components/terminal/worker-tab-visibility' // RA: include launch-only rows.
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { AgentStateDot, type AgentDotState } from '@/components/AgentStateDot'
import { AgentTypeIcon } from '@/components/agent/icons/agent-type-icon'
import { agentRowDisplayDotState } from '@/lib/agent-status/presentation/agent-row-dot-state'
import { useNow } from '@/hooks/use-now'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { resolveAgentSessionTitle } from '../../../../../../shared/tab-title-resolution'
import { formatAgentTypeLabel } from '../../../../../../shared/agent-status/presentation/agent-type-label'
import { formatCompactDuration } from '../../../../../../shared/agent-status/presentation/agent-row-decay-state'
import { parsePaneKey } from '../../../../../../shared/workspace-layout/stable-pane-id'
import { resolveRuntimePaneTitleForLeaf } from '../../../../../../shared/runtime-pane-title-leaf-id'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { useWorktreeAgentActivation } from './use-worktree-agent-activation'
import { liveAgentTabRows } from './live-agent-tab-rows'
import { EMPTY_TABS } from './worktree-card-empty-inputs'
import {
  selectLivePtyIdsForWorktree,
  selectPaneForegroundAgentsForWorktree
} from './worktree-card-status-inputs'
import { cn } from '@/lib/class-names'
import { activateStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { selectTabAgentParents } from '@/components/tab-bar/tab-agent-lineage'
import { selectWorktreeAgentOrchestration } from './worktree-agent-orchestration-index'
import { useTranslate } from '@/i18n/use-translate'

function LiveAgentRow({
  tabId,
  title,
  agentType,
  state,
  elapsed,
  onActivate
}: {
  tabId?: string
  title: string
  agentType: string
  state: AgentDotState
  elapsed: number
  onActivate: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-agent-tab-id={tabId}
      className="flex h-6 min-w-0 flex-1 items-center gap-1 rounded-sm px-1 text-left text-2xs hover:bg-worktree-sidebar-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring"
      onClick={onActivate}
    >
      <AgentTypeIcon agentType={agentType} size={12} />
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="min-w-0 flex-1 truncate">{title}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{title}</TooltipContent>
      </Tooltip>
      <AgentStateDot state={state} />
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {formatCompactDuration(elapsed)}
      </span>
    </button>
  )
}

// Count agent tabs, including launch-only agents; subagents share their parent's tab.
export function WorktreeLiveAgentRows({
  worktreeId,
  agents,
  className
}: {
  worktreeId: string
  agents: DashboardAgentRow[]
  className?: string
}): React.JSX.Element | null {
  const t = useTranslate()
  const [expanded, setExpanded] = useState(false)
  const [expandedSubagentTabs, setExpandedSubagentTabs] = useState<Set<string>>(() => new Set())
  const subagentsByTab = useMemo(
    () =>
      Map.groupBy(
        agents.filter((row) => row.rowSource === 'subagent'),
        (row) => row.tab.id
      ),
    [agents]
  )
  const tabs = useAppStore((s) => s.tabsByWorktree[worktreeId] ?? EMPTY_TABS)
  const structuredIds = useAppStore(
    useShallow((s) =>
      (s.unifiedTabsByWorktree?.[worktreeId] ?? [])
        .filter((tab) => tab.contentType === 'agent-session')
        .map((tab) => tab.id)
    )
  )
  const allTabs = useMemo(
    () => [
      ...new Map(
        [
          ...tabs,
          ...agents.filter((row) => structuredIds.includes(row.tab.id)).map((row) => row.tab)
        ].map((tab) => [tab.id, tab])
      ).values()
    ],
    [tabs, agents, structuredIds]
  )
  const foreground = useAppStore((s) => selectPaneForegroundAgentsForWorktree(s, worktreeId))
  const ptys = useAppStore((s) => selectLivePtyIdsForWorktree(s, worktreeId))
  const titles = useAppStore(
    useShallow((s) =>
      tabs.map((tab) => {
        const layout = s.terminalLayoutsByTabId?.[tab.id]
        return layout?.activeLeafId
          ? resolveRuntimePaneTitleForLeaf(
              layout,
              s.runtimePaneTitlesByTabId?.[tab.id],
              layout.activeLeafId
            )
          : null
      })
    )
  )
  const liveTitles = new Map(tabs.map((tab, i) => [tab.id, titles[i]]))
  const parentSignature = useAppStore((s) =>
    JSON.stringify([...selectTabAgentParents(s, worktreeId)])
  )
  const contexts = useAppStore((s) => selectWorktreeAgentOrchestration(s, worktreeId))
  const rows = useMemo(
    () =>
      liveAgentTabRows(
        allTabs,
        agents,
        ptys,
        foreground,
        new Set(structuredIds),
        new Map(JSON.parse(parentSignature)),
        contexts
      ),
    [allTabs, agents, ptys, foreground, structuredIds, parentSignature, contexts]
  )
  const now = useNow(30_000)
  const activate = useWorktreeAgentActivation(worktreeId)
  const activateRow = (tabId: string, paneKey?: string) => {
    revealWorkerTab(tabId)
    if (structuredIds.includes(tabId)) {
      activateAndRevealWorktree(worktreeId)
      activateStructuredAgentSessionTab({ worktreeId, tabId })
    } else if (paneKey && parsePaneKey(paneKey)) {
      activate(tabId, paneKey)
    } else {
      activateAndRevealWorktree(worktreeId)
      useAppStore.getState().setActiveTab(tabId)
    }
  }
  const toggleSubagents = (tabId: string) => {
    setExpandedSubagentTabs((current) => {
      const next = new Set(current)
      if (!next.delete(tabId)) {
        next.add(tabId)
      }
      return next
    })
  }
  if (!rows.length) {
    return null
  }
  return (
    <div
      className={cn('mt-1 flex min-w-0 flex-col gap-0.5', className)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-1 text-2xs text-muted-foreground">
        {t('sidebar.agentSummary.agentCount', '{{count}} agents', {
          count: rows.length,
          defaultValue_one: '{{count}} agent'
        })}
      </div>
      {(expanded ? rows : rows.slice(0, 6)).map((row) => {
        const tabId = row.tab.id
        const title =
          row.taskTitle ??
          resolveAgentSessionTitle(
            row.tab,
            liveTitles.get(tabId),
            formatAgentTypeLabel(row.agentType),
            row.providerSessionId
          )
        const subagents = subagentsByTab.get(tabId)
        const subagentsExpanded = expandedSubagentTabs.has(tabId)
        return (
          <div key={tabId} style={{ marginLeft: `${row.depth * 1.25}rem` }}>
            <div className="flex min-w-0">
              <LiveAgentRow
                tabId={tabId}
                title={title}
                agentType={row.agentType}
                state={row.state}
                elapsed={now - row.stateStartedAt}
                onActivate={() => activateRow(tabId, row.paneKey)}
              />
              {subagents && (
                <button
                  type="button"
                  data-agent-child-disclosure-button=""
                  className="min-w-6 shrink-0 rounded-sm px-1 text-2xs tabular-nums text-muted-foreground hover:bg-worktree-sidebar-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring"
                  aria-label={
                    subagentsExpanded
                      ? t(
                          'auto.components.dashboard.DashboardAgentChildDisclosure.hideChildAgents',
                          'Hide {{count}} child agents',
                          {
                            count: subagents.length,
                            defaultValue_one: 'Hide {{count}} child agent'
                          }
                        )
                      : t(
                          'auto.components.dashboard.DashboardAgentChildDisclosure.showChildAgents',
                          'Show {{count}} child agents',
                          {
                            count: subagents.length,
                            defaultValue_one: 'Show {{count}} child agent'
                          }
                        )
                  }
                  aria-expanded={subagentsExpanded}
                  onClick={() => toggleSubagents(tabId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.stopPropagation()
                    }
                  }}
                >
                  +{subagents.length}
                </button>
              )}
            </div>
            {subagentsExpanded && subagents && (
              <div className="ml-5 flex flex-col gap-0.5">
                {subagents.map((child) => (
                  <LiveAgentRow
                    key={child.paneKey}
                    title={child.entry.prompt || formatAgentTypeLabel(child.agentType)}
                    agentType={child.agentType}
                    state={agentRowDisplayDotState(child)}
                    elapsed={now - child.entry.stateStartedAt}
                    onActivate={() => activateRow(tabId, child.activationPaneKey)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
      {rows.length > 6 && (
        <button
          type="button"
          className="h-6 px-1 text-left text-2xs text-muted-foreground hover:text-foreground"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : `+${rows.length - 6} more`}
        </button>
      )}
    </div>
  )
}
