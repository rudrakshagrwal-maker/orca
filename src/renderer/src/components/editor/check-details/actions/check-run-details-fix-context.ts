import {
  buildFixBrokenChecksPrompt,
  getBrokenChecks,
  getCheckDetailsPromptKey
} from '../../../../../../shared/source-control/checks/pr-checks-fix-prompt'
import { useAppStore } from '@/store/index'
import { findFirstIndexedWorktree } from '@/lib/workspace/ownership/worktree-runtime-owner-index'
import type { HostedReviewInfo } from '../../../../../../shared/source-control/hosted-review/hosted-review-contracts'
import type { PRCheckDetail, PRCheckRunDetails } from '../../../../../../shared/github/check-types'
import type { Repo } from '../../../../../../shared/repo-types'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'

export function resolveCheckRunDetailsFixCheck(
  check: PRCheckDetail,
  details: PRCheckRunDetails | null
): PRCheckDetail {
  if (!details) {
    return check
  }
  return {
    ...check,
    status: (details.status as PRCheckDetail['status'] | undefined) ?? check.status,
    conclusion: (details.conclusion as PRCheckDetail['conclusion'] | undefined) ?? check.conclusion
  }
}

export function isCheckRunDetailsFixCandidate(
  check: PRCheckDetail,
  details: PRCheckRunDetails | null = null
): boolean {
  return getBrokenChecks([resolveCheckRunDetailsFixCheck(check, details)]).length > 0
}

// RA: the hosted-review and GitHub PR caches are removed, so there is no review to fix against.
export function resolveHostedReviewForCheckRunDetailsFix(
  _worktreeId: string
): HostedReviewInfo | null {
  return null
}

export function buildCheckRunDetailsFixBasePrompt(args: {
  worktreeId: string
  check: PRCheckDetail
  details: PRCheckRunDetails | null
}): string | null {
  const review = resolveHostedReviewForCheckRunDetailsFix(args.worktreeId)
  if (!review) {
    return null
  }
  const resolvedCheck = resolveCheckRunDetailsFixCheck(args.check, args.details)
  if (!isCheckRunDetailsFixCandidate(resolvedCheck)) {
    return null
  }
  const checkRunDetailsByCheckKey = args.details
    ? { [getCheckDetailsPromptKey(resolvedCheck, 0)]: args.details }
    : undefined
  return buildFixBrokenChecksPrompt({
    reviewKind: review.provider === 'gitlab' ? 'MR' : 'PR',
    reviewNumber: review.number,
    reviewTitle: review.title,
    reviewUrl: review.url,
    checks: [resolvedCheck],
    checkRunDetailsByCheckKey
  })
}

export function getCheckRunDetailsFixDisabledReason(
  worktreeId: string | null,
  t: Translate = translate
): string | undefined {
  if (!worktreeId) {
    return t(
      'auto.components.editor.check.run.details.fix.with.ai.1a8c4e2b90',
      'Select a workspace before launching an AI action.'
    )
  }
  const store = useAppStore.getState()
  const worktree = findFirstIndexedWorktree(selectWorktreesByRepo(store), worktreeId)
  if (!worktree) {
    return t(
      'auto.components.editor.check.run.details.fix.with.ai.1a8c4e2b90',
      'Select a workspace before launching an AI action.'
    )
  }
  const repo = store.repos.find((candidate) => candidate.id === worktree.repoId) ?? null
  if (!repo) {
    return t(
      'auto.components.editor.check.run.details.fix.with.ai.4f2d9a8c17',
      'Select a repository before launching an AI action.'
    )
  }
  if (!resolveHostedReviewForCheckRunDetailsFix(worktreeId)) {
    return t(
      'auto.components.editor.check.run.details.fix.with.ai.7c3e1b5d42',
      'Open a PR or MR before launching an AI fix.'
    )
  }
  return undefined
}

export function resolveCheckRunDetailsFixRepo(worktreeId: string | null): Repo | null {
  if (!worktreeId) {
    return null
  }
  const store = useAppStore.getState()
  const worktree = findFirstIndexedWorktree(selectWorktreesByRepo(store), worktreeId)
  if (!worktree) {
    return null
  }
  return store.repos.find((candidate) => candidate.id === worktree.repoId) ?? null
}
