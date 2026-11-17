import { useTranslate } from '@/i18n/use-translate'

import { coerceWorktreeCardVisibleTitle } from '../identity/worktree-card-title-display'
import { useWorkspaceDeleteModifierPressed } from '../../workspace-actions/deletion/workspace-delete-quick-action'
import type { WorktreeCardProps } from '../controller/worktree-card-model'
import type { useWorktreeCardFoundation } from '../controller/use-worktree-card-foundation'

type Foundation = ReturnType<typeof useWorktreeCardFoundation>

// RA: workspace titles and deletion state do not depend on issue providers.
export function useWorktreeCardLinkedDetails({
  worktree,
  deleteState
}: {
  worktree: WorktreeCardProps['worktree']
  deleteState: Foundation['deleteState']
}) {
  const t = useTranslate()
  const legacyCardTitleDisplay = coerceWorktreeCardVisibleTitle(worktree.displayName)
  const visibleCardTitle = legacyCardTitleDisplay
  const isDeleting = deleteState?.isDeleting ?? false
  const isQueuedForDeletion = deleteState?.phase === 'queued'
  const deleteLabel = isQueuedForDeletion
    ? t('auto.components.sidebar.WorktreeCard.ef18787206', 'Queued for deletion')
    : t('auto.components.sidebar.WorktreeCard.691ccfd622', 'Deleting…')
  const deleteModifierPressed = useWorkspaceDeleteModifierPressed()

  return { visibleCardTitle, isDeleting, isQueuedForDeletion, deleteLabel, deleteModifierPressed }
}
