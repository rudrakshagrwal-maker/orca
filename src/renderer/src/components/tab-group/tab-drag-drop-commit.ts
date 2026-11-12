import type { RefObject } from 'react'
import type { DragEndEvent } from '@dnd-kit/core'
import { useAppStore } from '../../store'
import { mirrorWebRuntimeTabMove } from '../tab-bar/web-runtime-tab-move-mirror'
import { resolveTabInsertion } from './tab-insertion'
import { resolveSourceGroupRestoreOnDrop } from './tab-drag-preview-target'
import { getDragPointer } from './tab-drag-pointer'
import {
  resolveActivePaneColumnSplitTarget,
  type TabGroupPanelGeometrySnapshot
} from './tab-group-panel-split-target'
import { isPaneDropData, isTabDragData, type TabDragItemData } from './tab-drag-data'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../../../shared/layout-owner-switch'
import { dropTabThroughLayoutOwner } from './tab-group-layout-owner-commands'
import { moveTabToGroup } from '../tab-bar/tab-move-to-pane-column'
import { selectTabAgentParents } from '../tab-bar/tab-agent-lineage'
import { agentLineageGroup, moveAgentLineageGroup } from '../tab-bar/agent-lineage-order'

type AppState = ReturnType<typeof useAppStore.getState>

// RA: main chooses a split's new group ID; move children only after its parent frame arrives.
function followParentSplit(
  worktreeId: string,
  parentId: string,
  sourceGroupId: string,
  children: string[]
): () => void {
  let stop: () => void = () => {}
  stop = useAppStore.subscribe((state) => {
    const parent = state.unifiedTabsByWorktree[worktreeId]?.find((tab) => tab.id === parentId)
    if (!parent) {
      stop()
      return
    }
    if (parent.groupId === sourceGroupId) {
      return
    }
    stop()
    const group = state.groupsByWorktree[worktreeId]?.find((item) => item.id === parent.groupId)
    if (!group) {
      return
    }
    const index = group.tabOrder.indexOf(parentId) + 1
    queueMicrotask(() => {
      for (const id of children.toReversed()) {
        moveTabToGroup({ worktreeId, unifiedTabId: id, groupId: parent.groupId, index })
      }
    })
  })
  return () => stop()
}

/** Commit splits/reorders/moves through the layout owner or window path, then finish or restore the drag snapshot. */
export function commitTabDragDrop({
  event,
  worktreeId,
  dragGeometryRef,
  dropUnifiedTab,
  reorderUnifiedTabs,
  finishDrag
}: {
  event: DragEndEvent
  worktreeId: string
  dragGeometryRef: RefObject<TabGroupPanelGeometrySnapshot | null>
  dropUnifiedTab: AppState['dropUnifiedTab']
  reorderUnifiedTabs: AppState['reorderUnifiedTabs']
  finishDrag: (restoreSnapshot: boolean, activeData?: TabDragItemData) => void
}): void {
  const activeData = event.active.data.current
  const overData = event.over?.data.current
  let shouldRestorePreDragActivation = true

  if (!isTabDragData(activeData) || activeData.worktreeId !== worktreeId) {
    finishDrag(true)
    return
  }

  const state = useAppStore.getState()
  const visibleParents = selectTabAgentParents(state, worktreeId)
  const unified = state.unifiedTabsByWorktree[worktreeId] ?? []
  const unifiedId = (id: string) => unified.find((tab) => tab.entityId === id)?.id ?? id
  const parents = new Map(
    [...visibleParents].map(([child, parent]) => [unifiedId(child), unifiedId(parent)])
  )
  const movingGroup = agentLineageGroup(activeData.unifiedTabId, parents)
  const paneColumnSplit = resolveActivePaneColumnSplitTarget({
    event,
    groupsByWorktree: state.groupsByWorktree,
    layoutByWorktree: state.layoutByWorktree,
    worktreeId,
    getDragPointer,
    geometry: dragGeometryRef.current
  })
  if (paneColumnSplit) {
    // RA: a lineage child cannot be split away from its parent.
    if (parents.has(activeData.unifiedTabId)) {
      finishDrag(true)
      return
    }
    const sourceOrder =
      state.groupsByWorktree[worktreeId]?.find((group) => group.id === activeData.groupId)
        ?.tabOrder ?? []
    const children = sourceOrder.filter(
      (id) => movingGroup.has(id) && id !== activeData.unifiedTabId
    )
    const stopFollowing = children.length
      ? followParentSplit(worktreeId, activeData.unifiedTabId, activeData.groupId, children)
      : () => {}
    // End the drag now; main’s answer draws the requested pane placement.
    if (
      ORCA_LAYOUT_OWNER_IS_MAIN &&
      dropTabThroughLayoutOwner(
        worktreeId,
        {
          kind: 'split',
          tabId: activeData.unifiedTabId,
          groupId: paneColumnSplit.groupId,
          direction: paneColumnSplit.zone
        },
        {
          refused: stopFollowing,
          moveHere: (move) => {
            move()
            stopFollowing()
          }
        }
      )
    ) {
      finishDrag(true)
      return
    }
    const moved = dropUnifiedTab(activeData.unifiedTabId, {
      groupId: paneColumnSplit.groupId,
      splitDirection: paneColumnSplit.zone
    })
    if (!moved) {
      stopFollowing()
    }
    if (moved) {
      shouldRestorePreDragActivation = false
      mirrorWebRuntimeTabMove({
        kind: 'split',
        worktreeId,
        tabId: activeData.unifiedTabId,
        targetGroupId: paneColumnSplit.groupId,
        splitDirection: paneColumnSplit.zone
      })
    }
    finishDrag(
      shouldRestorePreDragActivation,
      resolveSourceGroupRestoreOnDrop(
        activeData,
        paneColumnSplit.groupId,
        shouldRestorePreDragActivation
      )
    )
    return
  }

  if (!event.over) {
    finishDrag(true)
    return
  }

  if (isTabDragData(overData)) {
    if (activeData.unifiedTabId === overData.unifiedTabId) {
      finishDrag(true)
      return
    }

    const groups = state.groupsByWorktree[worktreeId] ?? []
    const targetGroup = groups.find((group) => group.id === overData.groupId)
    if (!targetGroup) {
      finishDrag(true)
      return
    }

    // Recompute insertion side at drop so the destination matches the drawn bar without stale closure state.
    const insertion = resolveTabInsertion(event, isTabDragData, getDragPointer)
    if (!insertion) {
      finishDrag(true)
      return
    }

    const overIndex = targetGroup.tabOrder.indexOf(overData.unifiedTabId)
    const rawInsertIndex = overIndex + (insertion.side === 'right' ? 1 : 0)

    if (activeData.groupId === overData.groupId) {
      const oldIndex = targetGroup.tabOrder.indexOf(activeData.unifiedTabId)
      // Adjust forward insertion after removing the source tab so the target slot does not shift left.
      const nextIndex = oldIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex
      if (oldIndex !== -1 && oldIndex !== nextIndex) {
        // RA: move a parent's entire subtree; normalizing a lone child snaps it home.
        const nextOrder = moveAgentLineageGroup(
          targetGroup.tabOrder,
          activeData.unifiedTabId,
          rawInsertIndex,
          parents
        )
        if (
          ORCA_LAYOUT_OWNER_IS_MAIN &&
          movingGroup.size === 1 &&
          dropTabThroughLayoutOwner(worktreeId, {
            kind: 'reorder',
            tabId: activeData.unifiedTabId,
            groupId: overData.groupId,
            tabOrder: nextOrder
          })
        ) {
          finishDrag(true)
          return
        }
        reorderUnifiedTabs(overData.groupId, nextOrder)
        mirrorWebRuntimeTabMove({
          kind: 'reorder',
          worktreeId,
          tabId: activeData.unifiedTabId,
          targetGroupId: overData.groupId,
          tabOrder: nextOrder
        })
      }
    } else {
      // RA: cross-pane drops move all descendants; children cannot escape their parent group.
      if (parents.has(activeData.unifiedTabId)) {
        finishDrag(true)
        return
      }
      if (movingGroup.size > 1) {
        const sourceOrder =
          state.groupsByWorktree[worktreeId]?.find((group) => group.id === activeData.groupId)
            ?.tabOrder ?? []
        const members = sourceOrder.filter((id) => movingGroup.has(id))
        for (const id of members.toReversed()) {
          moveTabToGroup(
            { worktreeId, unifiedTabId: id, groupId: overData.groupId, index: rawInsertIndex },
            dropUnifiedTab
          )
        }
        finishDrag(true)
        return
      }
      const moved = moveTabToGroup(
        {
          worktreeId,
          unifiedTabId: activeData.unifiedTabId,
          groupId: overData.groupId,
          index: overIndex === -1 ? targetGroup.tabOrder.length : rawInsertIndex
        },
        dropUnifiedTab
      )
      if (moved === 'owner') {
        finishDrag(true)
        return
      }
      if (moved) {
        shouldRestorePreDragActivation = false
      }
    }

    finishDrag(
      shouldRestorePreDragActivation,
      resolveSourceGroupRestoreOnDrop(activeData, overData.groupId, shouldRestorePreDragActivation)
    )
    return
  }

  if (isPaneDropData(overData)) {
    if (activeData.groupId !== overData.groupId) {
      if (parents.has(activeData.unifiedTabId)) {
        finishDrag(true)
        return
      }
      if (movingGroup.size > 1) {
        const sourceOrder =
          state.groupsByWorktree[worktreeId]?.find((group) => group.id === activeData.groupId)
            ?.tabOrder ?? []
        const index =
          state.groupsByWorktree[worktreeId]?.find((group) => group.id === overData.groupId)
            ?.tabOrder.length ?? 0
        for (const id of sourceOrder.filter((key) => movingGroup.has(key)).toReversed()) {
          moveTabToGroup(
            { worktreeId, unifiedTabId: id, groupId: overData.groupId, index },
            dropUnifiedTab
          )
        }
        finishDrag(true)
        return
      }
      const moved = moveTabToGroup(
        {
          worktreeId,
          unifiedTabId: activeData.unifiedTabId,
          groupId: overData.groupId
        },
        dropUnifiedTab
      )
      if (moved === 'owner') {
        finishDrag(true)
        return
      }
      if (moved) {
        shouldRestorePreDragActivation = false
      }
    }
  }

  finishDrag(
    shouldRestorePreDragActivation,
    isPaneDropData(overData)
      ? resolveSourceGroupRestoreOnDrop(
          activeData,
          overData.groupId,
          shouldRestorePreDragActivation
        )
      : undefined
  )
}
