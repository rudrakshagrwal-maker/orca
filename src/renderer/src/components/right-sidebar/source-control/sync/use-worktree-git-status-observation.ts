import { useCallback, useEffect, useRef } from 'react'
import type { SourceControlScope } from '../panel/worktree-scope'
import { useAppStore } from '@/store/index'
import { useRepoById } from '@/store/repos/use-repository-catalog'
import { useWorktreeById } from '@/store/workspaces/selection/use-selected-worktree'
import { isGitRepoKind } from '../../../../../../shared/repo-kind'
import { getExecutionHostIdForWorktree } from '@/lib/workspace/ownership/worktree-runtime-owner'
import { resolveWorktreeGitCopyNow } from '@/lib/workspace/ownership/worktree-git-copy'
import { isWindowVisible } from '@/lib/window-activity/window-visibility-interval'
import { getRuntimeGitStatus } from '@/runtime/source-control/git/runtime-git-status-client'

// RA: shared across observer remounts and worktree switches; never schedule a timer.
const repoRefreshes = new Map<string, { at: number; pending: boolean; refreshMetadata: boolean }>()
const MIN_REFRESH_MS = 60_000

export function useWorktreeGitStatusObservation(
  owner: SourceControlScope | null,
  options: { enabled?: boolean } = {}
): () => void {
  const enabled = options.enabled ?? true
  const worktreeId = useAppStore((s) => owner?.worktreeId ?? s.activeWorktreeId)
  const selectedWorktree = useWorktreeById(owner ? null : worktreeId)
  const worktree = owner?.worktree ?? selectedWorktree
  const hostId = useAppStore(
    (s) => owner?.executionHostId ?? getExecutionHostIdForWorktree(s, worktreeId)
  )
  const selectedRepo = useRepoById(owner ? null : (worktree?.repoId ?? null))
  const repo = owner?.repo ?? selectedRepo
  const path = worktree?.path
  const repoId = repo?.id
  const git = repo ? isGitRepoKind(repo) : false
  const generation = useRef(0)
  const refresh = useCallback(
    (explicit = false): void => {
      if (!enabled || !git || !worktreeId || !path || !repoId || !isWindowVisible()) {
        return
      }
      const copy = resolveWorktreeGitCopyNow(worktreeId, hostId)
      if (!copy) {
        return
      }
      const key = `${hostId}\0${repoId}`
      const held = repoRefreshes.get(key) ?? {
        at: -Infinity,
        pending: false,
        refreshMetadata: false
      }
      held.refreshMetadata ||= explicit
      repoRefreshes.set(key, held)
      if (held.pending || Date.now() - held.at < MIN_REFRESH_MS) {
        return
      }
      held.at = Date.now()
      held.pending = true
      const refreshMetadata = held.refreshMetadata
      held.refreshMetadata = false
      const currentGeneration = generation.current
      void getRuntimeGitStatus(
        {
          target: copy.transport,
          worktreeId,
          worktreePath: path,
          connectionId: copy.connectionId
        },
        { summaryOnly: true, refreshMetadata, includeLineStats: false, admissionTier: 'status' }
      )
        .then((status) => {
          if (generation.current !== currentGeneration) {
            return
          }
          const state = useAppStore.getState()
          state.setGitStatus(worktreeId, status)
          state.updateWorktreeGitIdentity(
            worktreeId,
            {
              head: status.head,
              branch: status.branch ?? (status.head ? null : undefined)
            },
            copy.hostId
          )
          if (status.upstreamStatus) {
            state.setUpstreamStatus(worktreeId, status.upstreamStatus)
          }
        })
        .catch(() => {})
        .finally(() => {
          held.pending = false
        })
    },
    [enabled, git, worktreeId, path, repoId, hostId]
  )

  useEffect(() => {
    // RA: only selection, window focus/reveal and explicit refresh read git state.
    generation.current += 1
    refresh()
    const onExplicitRefresh = (): void => refresh(true)
    const onFocus = (): void => refresh()
    const onVisibility = (): void => {
      if (isWindowVisible()) {
        refresh()
      }
    }
    window.addEventListener('orca:refresh-git-summary', onExplicitRefresh)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      generation.current += 1
      window.removeEventListener('orca:refresh-git-summary', onExplicitRefresh)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])
  return useCallback(() => refresh(true), [refresh])
}
