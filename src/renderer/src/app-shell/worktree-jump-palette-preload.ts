import { useEffect } from 'react'
import { backgroundJobsDisabled } from '../../../shared/fork-background-policy'
import { scheduleAfterInputQuiet } from '@/lib/input-quiet-scheduler'
import { lazyWithPreload } from '@/lib/lazy-with-retry'

export const WorktreeJumpPalette = lazyWithPreload(
  () => import('../components/worktree-jump/WorktreeJumpPalette')
)

/** Loads the Cmd+J palette after startup settles so its first open renders without suspending. */
export function usePreloadWorktreeJumpPalette(): void {
  useEffect(() => {
    // RA: load the jump palette on its first open instead of warming an unused subtree.
    if (backgroundJobsDisabled()) {
      return
    }
    return scheduleAfterInputQuiet(WorktreeJumpPalette.preload, {
      delayMs: 500,
      quietMs: 300,
      idleTimeoutMs: 1_000,
      maxWaitMs: 2_000
    })
  }, [])
}
