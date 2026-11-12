import { useMemo, useState } from 'react'
import { revealWorkerTab } from '@/components/terminal/worker-tab-visibility' // RA: include launch-only rows.
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { AgentStateDot } from '@/components/AgentStateDot'
import { AgentTypeIcon } from '@/components/agent/icons/agent-type-icon'
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

// RA: flat, dense showcase stays one row per live agent tab, including launch-only agents.
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
        const title =
          row.taskTitle ??
          resolveAgentSessionTitle(
            row.tab,
            liveTitles.get(row.tab.id),
            formatAgentTypeLabel(row.agentType),
            row.providerSessionId
          )
        const waiting = row.state === 'waiting' || row.state === 'blocked'
        const stateLabel = waiting
          ? 'Waiting for you'
          : row.state === 'working'
            ? 'Working'
            : row.state === 'done'
              ? 'Done'
              : row.state === 'unverifiable'
                ? 'No recent update'
                : 'Idle'
        return (
          <Tooltip key={row.tab.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-agent-tab-id={row.tab.id}
                style={{ marginLeft: `${row.depth * 1.25}rem` }}
                className="flex h-6 min-w-0 items-center gap-1 rounded-sm px-1 text-left text-2xs hover:bg-worktree-sidebar-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring"
                onClick={() => {
                  revealWorkerTab(row.tab.id) // RA: a row is the explicit visibility request.
                  if (structuredIds.includes(row.tab.id)) {
                    activateAndRevealWorktree(worktreeId)
                    activateStructuredAgentSessionTab({ worktreeId, tabId: row.tab.id })
                  } else if (row.paneKey && parsePaneKey(row.paneKey)) {
                    activate(row.tab.id, row.paneKey)
                  } else {
                    activateAndRevealWorktree(worktreeId)
                    useAppStore.getState().setActiveTab(row.tab.id)
                  }
                }}
              >
                <AgentTypeIcon agentType={row.agentType} size={12} />
                <span className="min-w-0 flex-1 truncate">{title}</span>
                <AgentStateDot state={row.state} title={null} />
                <span
                  className={cn(
                    'shrink-0',
                    waiting
                      ? 'text-amber-500'
                      : row.state === 'working'
                        ? 'text-agent-working'
                        : row.state === 'done'
                          ? 'text-emerald-500'
                          : 'text-muted-foreground'
                  )}
                >
                  {stateLabel}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatCompactDuration(now - row.stateStartedAt)}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{title}</TooltipContent>
          </Tooltip>
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
