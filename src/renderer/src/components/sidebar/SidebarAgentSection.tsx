import React, { useMemo, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { useWorktreeMap } from '@/store/slices/worktrees/listing/use-worktree-catalog'
import {
  selectDetectedWorktreesByRepo,
  selectFolderWorkspaces
} from '@/store/workspaces/catalog/workspace-record-fields'
import DashboardAgentRow from '@/components/dashboard/DashboardAgentRow'
import type { DashboardAgentRow as AgentRow } from '@/components/dashboard/useDashboardData'
import {
  createWorktreeAgentRowsCache,
  startWorktreeAgentRowsCachePass,
  finishWorktreeAgentRowsCachePass,
  selectWorktreeAgentRowsCached
} from '@/components/dashboard/worktree-agent-rows-cache'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/class-names'
import { translate } from '@/i18n/i18n'
import { useUiLanguageRevision } from '@/i18n/use-ui-language-revision'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'
import {
  EMPTY_WORKTREE_AGENT_ORCHESTRATION,
  selectWorktreeAgentOrchestrationIndex
} from './workspace-card/activity/worktree-agent-orchestration-index'
import { activateWorktreeAgentPane } from './workspace-card/activity/use-worktree-agent-activation'
import { activateRetainedAgentRow } from './workspace-card/activity/activate-retained-agent-row'
import { buildSidebarAgentTree } from './sidebar-agent-tree'
import { getFocusedAgentPaneKeyForWorktree } from './workspace-card/activity/focused-agent-row-highlight'
import { useSidebarAgentSectionResize, SIDEBAR_AGENTS_MIN_HEIGHT } from './use-sidebar-agent-section-resize'
import { AgentStateDot } from '@/components/AgentStateDot'
import { selectVisibleAgentOrchestration } from '@/runtime/agent-orchestration/visible-agent-orchestration'

const COLLAPSE_KEY = 'ra:sidebar-agents'

// RA: persist disclosure in the existing UI store; closed sections hold no row subscriptions.
export default function SidebarAgentSection(): React.JSX.Element {
  useUiLanguageRevision()
  const open = useAppStore((s) => !s.collapsedGroups.has(COLLAPSE_KEY))
  const toggleCollapsedGroup = useAppStore((s) => s.toggleCollapsedGroup)
  const resize = useSidebarAgentSectionResize() // RA: persisted vertical splitter.
  return (
    <Collapsible
      ref={resize.sectionRef}
      open={open}
      onOpenChange={() => toggleCollapsedGroup(COLLAPSE_KEY)}
      className="flex min-h-0 shrink-0 flex-col"
      style={{ height: open ? resize.height : undefined, maxHeight: open ? resize.maxHeight : undefined,
        minHeight: open ? SIDEBAR_AGENTS_MIN_HEIGHT : undefined }}
    >
      {/* RA: a six-pixel splitter with a one-pixel hairline leaves Projects reachable. */}
      <div role="separator" aria-orientation="horizontal" tabIndex={0}
        aria-label={translate('ra.sidebar.resizeAgents', 'Resize Agents section')}
        aria-valuemin={SIDEBAR_AGENTS_MIN_HEIGHT} aria-valuemax={resize.maxHeight}
        aria-valuenow={resize.height ?? SIDEBAR_AGENTS_MIN_HEIGHT}
        className="group flex h-1.5 shrink-0 cursor-row-resize touch-none items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring"
        {...resize.handleProps}>
        <div className="h-px w-full bg-worktree-sidebar-border group-hover:bg-worktree-sidebar-foreground/40" />
      </div>
      <CollapsibleTrigger className="flex h-7 shrink-0 items-center gap-1 px-3 text-left text-[13px] font-medium text-worktree-sidebar-foreground hover:bg-worktree-sidebar-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring">
        <ChevronRight className={cn('size-3.5', open && 'rotate-90')} aria-hidden />
        {translate('ra.sidebar.agents', 'Agents')}
      </CollapsibleTrigger>
      <CollapsibleContent className="worktree-sidebar-scrollbar min-h-0 overflow-auto px-1 pb-1">
        {open ? <SidebarAgentSectionBody /> : null}
      </CollapsibleContent>
    </Collapsible>
  )
}

function SidebarAgentSectionBody(): React.JSX.Element {
  // RA: each orchestrator folds independently, including orchestrators below another parent.
  const collapsedGroups = useAppStore((s) => s.collapsedGroups)
  const toggleCollapsedGroup = useAppStore((s) => s.toggleCollapsedGroup)
  const languageRevision = useUiLanguageRevision()
  const cacheRef = useRef<ReturnType<typeof createWorktreeAgentRowsCache>>(undefined!)
  cacheRef.current ??= createWorktreeAgentRowsCache()
  const inputs = useAppStore(
    useShallow((s) => ({
      agentStatusByPaneKey: s.agentStatusByPaneKey,
      retainedAgentsByPaneKey: s.retainedAgentsByPaneKey,
      migrationUnsupportedByPtyId: s.migrationUnsupportedByPtyId,
      tabsByWorktree: s.tabsByWorktree,
      unifiedTabsByWorktree: s.unifiedTabsByWorktree,
      orchestrationByWorktree: selectWorktreeAgentOrchestrationIndex(s),
      runtimeAgentOrchestrationByPaneKey: selectVisibleAgentOrchestration(s), // RA: retain closed ancestors and remote aliases.
      terminalLayoutsByTabId: s.terminalLayoutsByTabId,
      ptyIdsByTabId: s.ptyIdsByTabId,
      runtimePaneTitlesByTabId: s.runtimePaneTitlesByTabId,
      paneForegroundAgentByPaneKey: s.paneForegroundAgentByPaneKey,
      agentStatusEpoch: s.agentStatusEpoch
    }))
  )
  // RA: use upstream's cached catalog hook after the selector module was split.
  const worktreeMap = useWorktreeMap()
  const folderWorkspaces = useAppStore(selectFolderWorkspaces)
  const detectedWorktreesByRepo = useAppStore(selectDetectedWorktreesByRepo)
  const acknowledgedAgentsByPaneKey = useAppStore((s) => s.acknowledgedAgentsByPaneKey)
  const focusedPaneKey = useAppStore((s) =>
    s.activeWorktreeId ? getFocusedAgentPaneKeyForWorktree(s, s.activeWorktreeId) : null
  )
  const rows = useMemo(() => {
    const worktreeIds = new Set([
      ...Object.keys(inputs.tabsByWorktree),
      ...Object.keys(inputs.unifiedTabsByWorktree)
    ])
    for (const entry of Object.values(inputs.agentStatusByPaneKey)) {
      if (entry.worktreeId) {
        worktreeIds.add(entry.worktreeId)
      }
    }
    for (const entry of Object.values(inputs.retainedAgentsByPaneKey)) {
      worktreeIds.add(entry.worktreeId)
    }
    const cache = cacheRef.current
    startWorktreeAgentRowsCachePass(cache)
    const allRows = [...worktreeIds].flatMap((worktreeId) =>
      selectWorktreeAgentRowsCached({
        state: inputs,
        worktreeId,
        orchestration:
          inputs.orchestrationByWorktree.get(worktreeId) ?? EMPTY_WORKTREE_AGENT_ORCHESTRATION,
        now: Date.now(),
        generation: inputs.agentStatusEpoch,
        cache
      })
    )
    finishWorktreeAgentRowsCachePass(cache)
    return allRows
  }, [inputs])
  const now = useNow(30_000, rows.length > 0)
  const tree = useMemo(
    () => buildSidebarAgentTree(rows, { ...inputs, acknowledgedAgentsByPaneKey },
      inputs.runtimeAgentOrchestrationByPaneKey),
    [rows, inputs, acknowledgedAgentsByPaneKey]
  )
  const workspaceNames = useMemo(() => {
    void languageRevision
    const names = new Map([...worktreeMap].map(([id, worktree]) => [id, worktree.displayName]))
    for (const detected of Object.values(detectedWorktreesByRepo)) {
      for (const worktree of detected.worktrees) {
        if (!names.has(worktree.id)) {
          names.set(worktree.id, worktree.displayName)
        }
      }
    }
    for (const workspace of folderWorkspaces) {
      names.set(folderWorkspaceKey(workspace.id), workspace.name)
    }
    names.set(FLOATING_TERMINAL_WORKTREE_ID, translate('ra.sidebar.floatingTerminals', 'Terminals'))
    return names
  }, [worktreeMap, folderWorkspaces, detectedWorktreesByRepo, languageRevision])
  const renderBranch = (
    agent: AgentRow,
    ancestors: ReadonlySet<string>,
    lastSibling = true
  ): React.ReactNode => {
    if (ancestors.has(agent.paneKey)) {
      return null
    }
    const children = tree.childrenByParentPaneKey.get(agent.paneKey) ?? []
    const collapseKey = `ra:sidebar-agent:${agent.paneKey}`
    const expanded = !collapsedGroups.has(collapseKey)
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(agent.paneKey)
    const worktreeId = agent.tab.worktreeId
    const activate = (tabId: string, paneKey: string): void => {
      if (agent.rowSource === 'retained') {
        activateRetainedAgentRow(worktreeId, tabId, paneKey)
      } else {
        activateWorktreeAgentPane(worktreeId, tabId, paneKey)
      }
    }
    return (
      <li key={agent.paneKey} className="relative min-w-0">
        {ancestors.size > 0 ? (
          <>
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute -left-2 top-0 border-l border-worktree-sidebar-border',
                lastSibling ? 'h-3.5' : 'bottom-0'
              )}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -left-2 top-3.5 w-2 border-t border-worktree-sidebar-border"
            />
          </>
        ) : null}
        {/* RA: closed parents stay dim and cannot activate a surviving child's tab by accident. */}
        {tree.closedParentPaneKeys.has(agent.paneKey) ? (
          <div className="flex h-7 items-center gap-1.5 px-2 text-[13px] text-muted-foreground">
            <button type="button" aria-expanded={expanded} onClick={() => toggleCollapsedGroup(collapseKey)}
              aria-label={translate('ra.sidebar.toggleHelpers', 'Toggle helpers')}>
              <ChevronRight className={cn('size-3.5', expanded && 'rotate-90')} aria-hidden />
            </button>
            <span className="min-w-0 flex-1 truncate">{translate('ra.sidebar.closedParent', 'closed: {{title}}', { title: agent.tab.title })}</span>
            {!expanded ? <span>+{children.length}</span> : null}
            <AgentStateDot state={tree.descendantStates.get(agent.paneKey) ?? 'idle'} size="md" />
          </div>
        ) : <DashboardAgentRow
          agent={agent}
          sidebarTreeRow
          sidebarWorkspaceName={
            ancestors.size === 0 ? (workspaceNames.get(worktreeId) ?? worktreeId) : undefined
          }
          childAgentCount={children.length}
          childAgentsExpanded={expanded}
          collapsedChildAgentsState={tree.descendantStates.get(agent.paneKey)}
          onToggleChildAgents={() => toggleCollapsedGroup(collapseKey)}
          onDismiss={useAppStore.getState().dropAgentStatus}
          onActivate={activate}
          isUnvisited={tree.unvisitedPaneKeys.has(agent.paneKey)}
          isFocusedPane={agent.paneKey === focusedPaneKey}
          now={now}
        />}
        {children.length > 0 && expanded ? (
          <ul className="ml-3 list-none pl-2">
            {children.map((child, index) =>
              renderBranch(child, nextAncestors, index === children.length - 1)
            )}
          </ul>
        ) : null}
      </li>
    )
  }
  return (
    <>
      {/* RA: one hierarchy; status glyphs stay on their existing rows. */}
      <ul className="list-none">{tree.rootRows.map((root) => renderBranch(root, new Set()))}</ul>
      {rows.length === 0 ? (
        <div className="px-2 py-1 text-[13px] text-muted-foreground">
          {translate('ra.sidebar.noAgents', 'No agents')}
        </div>
      ) : null}
    </>
  )
}
