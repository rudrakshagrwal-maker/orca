import { useWorktreeGitStatusObservation } from './use-worktree-git-status-observation'

// RA: keep the caller contract, with no safety/status/conflict polling or inactive-worktree subscriptions.
export function useGitStatusPolling(options: { enabled?: boolean } = {}): void {
  useWorktreeGitStatusObservation(null, options)
}
