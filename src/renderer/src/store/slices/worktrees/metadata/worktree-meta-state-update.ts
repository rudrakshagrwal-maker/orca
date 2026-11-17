import type { WorktreeMetaBatchUpdate } from './worktree-meta-update-options'
import type { WorktreeSliceGet } from '../listing/worktree-slice-types'
import {
  selectWorktreesByRepo,
  selectDetectedWorktreesByRepo
} from '../../../workspaces/catalog/workspace-record-fields'
import type { Repo } from '../../../../../../shared/repo-types'
import { applyWorktreeUpdates } from './worktree-meta-update-application'
import { applyDetectedWorktreeUpdates } from '../listing/detected-worktree-meta'

type WorktreeMetaStateUpdate = WorktreeMetaBatchUpdate & {
  reviewRepo?: Repo
  reviewBranch?: string
}

export function buildWorktreeMetaStateUpdate(
  s: ReturnType<WorktreeSliceGet>,
  { worktreeId, updates, executionHostId }: WorktreeMetaStateUpdate
) {
  const worktreesByRepo = selectWorktreesByRepo(s)
  const detectedWorktreesByRepo = selectDetectedWorktreesByRepo(s)
  const nextWorktrees = applyWorktreeUpdates(worktreesByRepo, worktreeId, updates, executionHostId)
  const nextDetectedWorktrees = applyDetectedWorktreeUpdates(
    detectedWorktreesByRepo,
    worktreeId,
    updates,
    executionHostId
  )

  // RA: workspace edits no longer invalidate removed task-provider caches.
  if (nextWorktrees === worktreesByRepo && nextDetectedWorktrees === detectedWorktreesByRepo) {
    return s
  }
  return {
    ...(nextWorktrees !== worktreesByRepo
      ? { worktreesByRepo: nextWorktrees, sortEpoch: s.sortEpoch + 1 }
      : {}),
    ...(nextDetectedWorktrees !== detectedWorktreesByRepo
      ? { detectedWorktreesByRepo: nextDetectedWorktrees }
      : {})
  }
}
