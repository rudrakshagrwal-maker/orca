import { canShowWorkspaceDeleteQuickAction } from '../../workspace-actions/deletion/workspace-delete-quick-action'
import { useWorktreeCardDetailsHoverControl } from '../details/worktree-card-details-hover-state'
import type { ResolvedWorktreeCardProps } from './worktree-card-model'
import { useWorktreeCardActivationActions } from './use-worktree-card-activation-actions'
import { useWorktreeCardFoundation } from './use-worktree-card-foundation'

import { useWorktreeCardLinkedDetails } from '../details/use-worktree-card-linked-details'
import { useWorktreeCardReviewDetails } from '../details/use-worktree-card-review-details'
import { useWorktreeCardSecondaryDetails } from '../details/use-worktree-card-secondary-details'
import { useWorktreeCardWorkspaceActions } from './use-worktree-card-workspace-actions'

export function useWorktreeCardController(props: ResolvedWorktreeCardProps) {
  const { worktree, repo } = props
  const foundation = useWorktreeCardFoundation({ worktree, repo })
  const review = useWorktreeCardReviewDetails({
    worktree,
    repo,
    projectGroups: foundation.projectGroups,
    cardProps: foundation.cardProps,
    newCardStyle: foundation.newCardStyle
  })
  const linked = useWorktreeCardLinkedDetails({ worktree, deleteState: foundation.deleteState })

  // RA: the status lane keeps agent activity; task providers have no sidebar consumers.
  const showStatus = foundation.cardProps.includes('status')
  const showComment = foundation.cardDetails.comment
  const detailsHoverControl = useWorktreeCardDetailsHoverControl()

  const activation = useWorktreeCardActivationActions({
    worktree,
    repo,
    affiliateListMode: props.affiliateListMode,
    onSelectionGesture: props.onSelectionGesture,
    isActive: props.isActive,
    activationRowKey: props.activationRowKey,
    onActivate: props.onActivate,
    onWorktreeCardClick: props.onWorktreeCardClick,
    onImmediateActivate: props.onImmediateActivate,
    isDeleting: linked.isDeleting,
    isSshDisconnected: foundation.isSshDisconnected,
    updateWorktreeMeta: foundation.updateWorktreeMeta,
    setWorkspaceUnreadByUser: foundation.setWorkspaceUnreadByUser,
    openModal: foundation.openModal
  })

  // Why: delete is destructive, so it only appears while holding Option/Alt, not in the ordinary hover chrome.
  const showDeleteQuickAction =
    !props.affiliateListMode &&
    canShowWorkspaceDeleteQuickAction({
      deleteModifierPressed: linked.deleteModifierPressed,
      isDeleting: linked.isDeleting,
      isMainWorktree: worktree.isMainWorktree
    })
  const workspaceActions = useWorktreeCardWorkspaceActions({
    worktree,
    lineageChildCount: props.lineageChildCount,
    lineageCollapsed: props.lineageCollapsed,
    onLineageToggle: props.onLineageToggle,
    isMultiSelected: props.isMultiSelected,
    selectedWorktrees: props.selectedWorktrees,
    onCardDragStart: props.onCardDragStart,
    onCardDragEnd: props.onCardDragEnd,
    onContextMenuSelect: props.onContextMenuSelect,
    folderWorkspaceId: review.folderWorkspaceId,
    setShowRenameErrorDialog: foundation.setShowRenameErrorDialog,
    isDeleting: linked.isDeleting,
    showDeleteQuickAction
  })

  const secondary = useWorktreeCardSecondaryDetails({
    worktree,
    showStatus,
    showComment,
    compactCards: foundation.compactCards,
    cardDetails: foundation.cardDetails,
    agentActivityDisplayMode: foundation.agentActivityDisplayMode,
    settings: foundation.settings
  })

  return {
    ...props,
    ...foundation,
    ...review,
    ...linked,
    detailsHoverControl,
    showStatus,
    showComment,
    ...activation,
    showDeleteQuickAction,
    ...workspaceActions,
    ...secondary
  }
}

export type WorktreeCardController = ReturnType<typeof useWorktreeCardController>
