import { useWorktreeAgentRows } from '../activity/useWorktreeAgentRows'
import { usePromptCacheCountdownStartedAt } from '../activity/CacheTimer'
import type { useWorktreeCardFoundation } from '../controller/use-worktree-card-foundation'
import type { WorktreeCardProps } from '../controller/worktree-card-model'
type Foundation = ReturnType<typeof useWorktreeCardFoundation>
// RA: card details retain comments and inline agents without task, port or automation surfaces.
export function useWorktreeCardSecondaryDetails({
  worktree,
  showStatus,
  showComment,
  compactCards,
  cardDetails,
  agentActivityDisplayMode,
  settings
}: Pick<WorktreeCardProps, 'worktree'> &
  Pick<Foundation, 'compactCards' | 'cardDetails' | 'agentActivityDisplayMode' | 'settings'> & {
    showStatus: boolean
    showComment: boolean
  }) {
  const showInlineAgentList = cardDetails.inlineAgents
  const compactInlineAgentRows = useWorktreeAgentRows(
    worktree.id,
    showInlineAgentList && agentActivityDisplayMode === 'compact'
  )
  const aggregate =
    !compactCards &&
    !(
      showInlineAgentList &&
      agentActivityDisplayMode === 'compact' &&
      compactInlineAgentRows.length > 0
    )
  const cacheStartedAt = usePromptCacheCountdownStartedAt(worktree.id, aggregate)
  const metaComment = showComment ? worktree.comment : null
  return {
    showUnreadEmphasis: showStatus && worktree.isUnread,
    hoverComment: worktree.comment,
    metaComment,
    showInlineAgentList,
    compactInlineAgentRows,
    hasDetails: Boolean(metaComment),
    cacheStartedAt,
    cacheTtlMs: aggregate ? (settings?.promptCacheTtlMs ?? 0) : 0
  }
}
