import type { GitStatusResult } from '../../../shared/git/status/git-status-types'
import { invalidateGitSessionMetadata } from '../command-runner/git-session-metadata-cache'

// RA: one host budget covers every window without giving another checkout the wrong branch.
const summaries = new Map<string, { at: number; path: string; result: Promise<GitStatusResult> }>()

export function readRepositoryGitSummary(
  repository: string,
  path: string,
  read: () => Promise<GitStatusResult>,
  refreshMetadata = false
): Promise<GitStatusResult> {
  if (refreshMetadata) {
    invalidateGitSessionMetadata()
  }
  const previous = summaries.get(repository)
  if (previous && Date.now() - previous.at < 60_000) {
    return previous.path === path
      ? previous.result
      : Promise.reject(new Error('Repository git summary is limited to once per minute'))
  }
  const result = read()
  summaries.set(repository, { at: Date.now(), path, result })
  return result
}
