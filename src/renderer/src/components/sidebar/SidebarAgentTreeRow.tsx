import { ChevronRight } from 'lucide-react' // RA: disclosure without orchestrator badges.
import type { MouseEvent } from 'react'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { AgentStateDot, type AgentDotState } from '@/components/AgentStateDot'
import { AgentTypeIcon } from '@/lib/agent-type-icon'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import { resolveRuntimePaneTitleForLeaf } from '../../../../shared/runtime-pane-title-leaf-id'
import { agentTerminalTitle } from '../../../../shared/agent-title-decoration'
import { formatCompactDuration } from '../../../../shared/agent-row-decay-state'

type Props = {
  agent: DashboardAgentRow
  displayLabel: string
  dotState: AgentDotState
  dotTooltipLabel: string
  highlighted: boolean
  isUnvisited: boolean
  now: number
  workspaceName?: string
  activationDisabled?: boolean // RA: dim closed ancestors without disabling their disclosure.
  childAgentCount?: number
  childAgentsExpanded: boolean
  onToggleChildAgents?: () => void
  onActivate: (event: MouseEvent) => void
}

// RA: keep terminal activation separate from the tree disclosure.
export function SidebarAgentTreeRow({
  agent, displayLabel, dotState, dotTooltipLabel, highlighted, isUnvisited, now,
  workspaceName, activationDisabled, childAgentCount, childAgentsExpanded, onToggleChildAgents, onActivate
}: Props): React.JSX.Element {
  const livePaneTitle = useAppStore((s) => {
    if (agent.rowSource === 'subagent') { return '' }
    const parsed = parsePaneKey(agent.paneKey)
    return parsed ? resolveRuntimePaneTitleForLeaf(s.terminalLayoutsByTabId?.[parsed.tabId],
      s.runtimePaneTitlesByTabId?.[parsed.tabId], parsed.leafId) ?? '' : ''
  })
  const title = agentTerminalTitle(agent.rowSource === 'subagent' ? displayLabel :
    agent.tab.customTitle?.trim() || livePaneTitle || agent.tab.title || displayLabel)
  const elapsed = Math.max(0, now - agent.entry.stateStartedAt)
  const elapsedLabel = elapsed < 60_000 ? '<1m' : formatCompactDuration(elapsed)
  const needsYou = dotState === 'blocked' || dotState === 'waiting' || dotState === 'permission'
  const hasChildren = (childAgentCount ?? 0) > 0
  const canFold = hasChildren && onToggleChildAgents !== undefined
  const status = needsYou ? (
    <span className="w-3 shrink-0 text-center font-semibold text-destructive" aria-label={dotTooltipLabel}>!</span>
  ) : <AgentStateDot state={dotState} size="md" title={dotTooltipLabel} />
  return (
    <div className="relative flex min-w-0 items-center">
      {canFold ? (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onToggleChildAgents?.() }}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation() }} // RA: disclosure keys must not activate the worktree card.
          aria-expanded={childAgentsExpanded}
          aria-label={translate('ra.sidebar.toggleHelpers', 'Toggle helpers')}
          className="absolute left-2 z-10 flex size-4 items-center justify-center rounded-sm hover:bg-worktree-sidebar-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring"
        >
          <ChevronRight className={cn('size-3.5 text-muted-foreground', childAgentsExpanded && 'rotate-90')} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onActivate}
        disabled={activationDisabled}
        data-current={highlighted ? 'true' : undefined}
        className={cn(
          'flex h-7 w-full min-w-0 items-center gap-1.5 rounded-sm px-2 text-left text-[13px] text-worktree-sidebar-foreground',
          'hover:bg-worktree-sidebar-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring',
          highlighted && 'bg-worktree-sidebar-accent',
          isUnvisited && 'font-semibold',
          activationDisabled && 'opacity-50'
        )}
        title={workspaceName ? `${workspaceName} · ${title}` : title}
      >
        {canFold ? <span className="size-3.5 shrink-0" /> : null}
        {/* RA: urgency stays on the left, elapsed time on the right. */}
        {status}
        <AgentTypeIcon agentType={agent.agentType} size={14} />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {canFold && !childAgentsExpanded ? <span className="text-xs text-muted-foreground">+{childAgentCount}</span> : null}
        <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">{elapsedLabel}</span>
      </button>
    </div>
  )
}
