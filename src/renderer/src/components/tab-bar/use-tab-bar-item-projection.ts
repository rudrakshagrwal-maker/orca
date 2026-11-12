import { useStructuredChatTabNames } from '@/runtime/native-chat/naming/structured-chat-name-observation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { GitFileStatus } from '../../../../shared/git/status/git-status-types'
import type { Tab } from '../../../../shared/tab-types'
import type { TabBarProps } from './tab-bar-props'
import {
  buildOrderedTabItems,
  buildTabDropIndicators,
  buildTabStripLayoutKey,
  findActiveVisibleTabId,
  type TabBarItem
} from './tab-bar-item-model'
import type { DropIndicator } from './drop-indicator'
import { sameStringArray } from '@/runtime/web-session-tabs-sync/state-equality-core'
import { useAppStore } from '@/store'
import { selectTabAgentParents } from './tab-agent-lineage'
import { orderAgentLineage } from './agent-lineage-order'
import { useHiddenWorkerTabSignature } from '../terminal/use-worker-tab-visibility' // RA: preserve host tab order.
import { moveTabToGroup } from './tab-move-to-pane-column'

export type TabBarItemProjection = {
  orderedItems: TabBarItem[]
  sortableIds: string[]
  dropIndicatorByVisibleId: Map<string, DropIndicator>
  activeVisibleTabId: string | null
  tabStripLayoutKey: string
}

export function useTabBarItemProjection({
  props,
  resolvedGroupId,
  unifiedTabs,
  unifiedTabByVisibleId,
  generatedTabTitlesEnabled,
  statusByRelativePath
}: {
  props: TabBarProps
  resolvedGroupId: string
  unifiedTabs: readonly Tab[]
  unifiedTabByVisibleId: Map<string, Tab>
  generatedTabTitlesEnabled: boolean
  statusByRelativePath: Map<string, GitFileStatus>
}): TabBarItemProjection {
  const {
    tabs,
    editorFiles,
    browserTabs,
    agentSessionTabs,
    tabBarOrder,
    hoveredTabInsertion,
    activeTabId,
    activeFileId,
    activeBrowserTabId,
    activeSimulatorTabId,
    activeTabType,
    expandedPaneByTabId
  } = props
  const terminalMap = useMemo(() => new Map(tabs.map((tab) => [tab.id, tab])), [tabs])
  const editorMap = useMemo(
    () => new Map((editorFiles ?? []).map((file) => [file.tabId ?? file.id, file])),
    [editorFiles]
  )
  const browserMap = useMemo(
    () => new Map((browserTabs ?? []).map((tab) => [tab.id, tab])),
    [browserTabs]
  )
  const agentSessionMap = useMemo(
    () => new Map((agentSessionTabs ?? []).map((tab) => [tab.id, tab])),
    [agentSessionTabs]
  )
  const terminalIds = useMemo(() => tabs.map((tab) => tab.id), [tabs])
  const editorFileIds = useMemo(
    () => editorFiles?.map((file) => file.tabId ?? file.id) ?? [],
    [editorFiles]
  )
  const browserTabIds = useMemo(() => browserTabs?.map((tab) => tab.id) ?? [], [browserTabs])
  const simulatorTabIds = useMemo(
    () =>
      unifiedTabs
        .filter((tab) => tab.groupId === resolvedGroupId && tab.contentType === 'simulator')
        .map((tab) => tab.id),
    [unifiedTabs, resolvedGroupId]
  )
  const agentSessionTabIds = useMemo(
    () => agentSessionTabs?.map((tab) => tab.id) ?? [],
    [agentSessionTabs]
  )
  const baseItems = useMemo(
    () =>
      buildOrderedTabItems({
        tabBarOrder,
        terminalIds,
        editorFileIds,
        browserTabIds,
        simulatorTabIds,
        agentSessionTabIds,
        terminalMap,
        editorMap,
        browserMap,
        agentSessionMap,
        unifiedTabByVisibleId
      }),
    [
      tabBarOrder,
      terminalIds,
      editorFileIds,
      browserTabIds,
      simulatorTabIds,
      agentSessionTabIds,
      terminalMap,
      editorMap,
      browserMap,
      agentSessionMap,
      unifiedTabByVisibleId
    ]
  )
  // RA: lineage changes are push-fed; no timer or remount is needed for set-parent.
  const parentSignature = useAppStore((s) =>
    JSON.stringify([...selectTabAgentParents(s, props.worktreeId)])
  )
  const pendingParentMoves = useRef(new Map<string, string>())
  const hiddenWorkerSignature = useHiddenWorkerTabSignature(props.worktreeId) // RA: sidebar-only workers.
  const orderedItems = useMemo(() => {
    const hidden = new Set<string>(JSON.parse(hiddenWorkerSignature)) // RA: do not retire the hidden rows.
    const parents = new Map<string, string>(JSON.parse(parentSignature))
    const unifiedToVisible = new Map(baseItems.map((item) => [item.unifiedTabId, item.id]))
    const visibleParents = new Map(
      [...parents].map(([child, parent]) => [
        unifiedToVisible.get(child) ?? child,
        unifiedToVisible.get(parent) ?? parent
      ])
    )
    const byId = new Map(baseItems.map((item) => [item.id, item]))
    return orderAgentLineage(
      baseItems.filter((item) => !hidden.has(item.id) && !hidden.has(item.unifiedTabId)).map((item) => item.id),
      visibleParents
    ).map((id) => byId.get(id)!)
  }, [baseItems, parentSignature, hiddenWorkerSignature])
  useEffect(() => {
    const store = useAppStore.getState()
    // RA: a child launched or re-parented into another pane follows its parent's strip too.
    const tabs = store.unifiedTabsByWorktree[props.worktreeId] ?? []
    const findTab = (id: string) => tabs.find((tab) => tab.id === id || tab.entityId === id)
    for (const [childId, parentId] of new Map<string, string>(JSON.parse(parentSignature))) {
      const child = findTab(childId)
      const parent = findTab(parentId)
      if (!child || !parent || parent.groupId !== resolvedGroupId) {
        continue
      }
      if (child.groupId === parent.groupId) {
        pendingParentMoves.current.delete(child.id)
        continue
      }
      const key = `${parent.id}:${parent.groupId}`
      if (pendingParentMoves.current.get(child.id) === key) {
        continue
      }
      pendingParentMoves.current.set(child.id, key)
      moveTabToGroup({
        worktreeId: props.worktreeId,
        unifiedTabId: child.id,
        groupId: parent.groupId
      })
    }
    const group = store.groupsByWorktree[props.worktreeId]?.find(
      (item) => item.id === resolvedGroupId
    )
    const desired = orderedItems.map((item) => item.unifiedTabId)
    if (
      group &&
      group.tabOrder.length === desired.length &&
      !sameStringArray(group.tabOrder, desired)
    ) {
      store.reorderUnifiedTabs(resolvedGroupId, desired, { recordInteraction: false })
      const visibleIds = orderedItems.map((item) => item.id)
      const members = new Set(visibleIds)
      let index = 0
      const order = (store.tabBarOrderByWorktree[props.worktreeId] ?? []).map((id) =>
        members.has(id) ? visibleIds[index++]! : id
      )
      order.push(...visibleIds.slice(index))
      store.setTabBarOrder(props.worktreeId, order)
    }
  }, [orderedItems, parentSignature, props.worktreeId, resolvedGroupId])
  const orderedIds = useMemo(() => orderedItems.map((item) => item.id), [orderedItems])
  // Why: dnd-kit re-renders every tab when this array's identity changes, and the items rebuild on any tab write.
  const [sortableIds, setSortableIds] = useState(orderedIds)
  if (!sameStringArray(sortableIds, orderedIds)) {
    setSortableIds(orderedIds)
  }
  const activeIndicator =
    hoveredTabInsertion?.groupId === resolvedGroupId ? hoveredTabInsertion : null
  const dropIndicatorByVisibleId = useMemo(
    () => buildTabDropIndicators(orderedItems, activeIndicator),
    [activeIndicator, orderedItems]
  )
  const activeVisibleTabId = useMemo(
    () =>
      findActiveVisibleTabId(orderedItems, {
        activeTabId,
        activeFileId,
        activeBrowserTabId,
        activeSimulatorTabId,
        activeTabType
      }),
    [
      activeBrowserTabId,
      activeFileId,
      activeSimulatorTabId,
      activeTabId,
      activeTabType,
      orderedItems
    ]
  )
  const chatNames = useStructuredChatTabNames()
  const tabStripLayoutKey = useMemo(
    () =>
      buildTabStripLayoutKey(
        orderedItems,
        generatedTabTitlesEnabled,
        expandedPaneByTabId,
        statusByRelativePath,
        chatNames
      ),
    [expandedPaneByTabId, generatedTabTitlesEnabled, orderedItems, statusByRelativePath, chatNames]
  )

  return {
    orderedItems,
    sortableIds,
    dropIndicatorByVisibleId,
    activeVisibleTabId,
    tabStripLayoutKey
  }
}
