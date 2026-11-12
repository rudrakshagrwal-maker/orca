import React from 'react'

import WorktreeCardAgents from '../activity/WorktreeCardAgents'
import {
  WorktreeCardDeleteFailed,
  WorktreeCardRemoteBranchConflict
} from '../metadata/worktree-card-meta-items'
import { WorktreeLineageToggle } from '../identity/WorktreeLineageToggle'
import type { WorktreeCardPresentation } from './worktree-card-presentation'
import type { WorktreeCardController } from '../controller/use-worktree-card-controller'

export function WorktreeCardSecondaryRows({
  card,
  presentation
}: {
  card: WorktreeCardController
  presentation: WorktreeCardPresentation
}): React.JSX.Element {
  const {
    worktree,
    lineageCollapsed,
    lineageChildWorktreeIds,
    onLineageToggle,
    remoteBranchConflict,
    showInlineAgentList,
    agentActivityDisplayMode,
    compactInlineAgentRows,
    showLineageChildChip,
    lineageChildAriaLabel,
    childWorkspaceShortLabel,
    isDeleting
  } = card
  const { hasMetaRow } = presentation

  return (
    <>
      {remoteBranchConflict && (
        <WorktreeCardRemoteBranchConflict
          remote={remoteBranchConflict.remote}
          branchName={remoteBranchConflict.branchName}
        />
      )}

      {/* The host retains failed deletes until resolved; show its path-leading error in a tooltip. */}
      {worktree.removalError && !isDeleting ? (
        <WorktreeCardDeleteFailed error={worktree.removalError} />
      ) : null}

      {/* RA: no automatic Linear skill-setup dialog or reminder toast. */}
      <QueuedWorkerRows worktreeId={worktree.id} /> {/* RA: queues remain visible even without agent rows. */}

      {/* Why: counterbalance the card stack gap (-mt-1) so agents right after the title read as one header group. */}
      {showInlineAgentList && (
        <WorktreeCardAgents
          worktreeId={worktree.id}
          agents={agentActivityDisplayMode === 'compact' ? compactInlineAgentRows : undefined}
          className={hasMetaRow || remoteBranchConflict ? 'mt-0' : '-mt-1'}
        />
      )}

      {showLineageChildChip && (
        <WorktreeLineageToggle
          childWorktreeIds={lineageChildWorktreeIds}
          collapsed={lineageCollapsed}
          ariaLabel={lineageChildAriaLabel}
          label={childWorkspaceShortLabel}
          count={card.lineageChildCount}
          onToggle={onLineageToggle}
        />
      )}
    </>
  )
}
import { QueuedWorkerRows } from '../activity/QueuedWorkerRows' // RA: no terminal surface for queued work.
