import { expect, it } from 'vitest'
import { readRepositoryGitSummary } from './repository-git-summary'
import type { GitStatusResult } from '../../../shared/git/status/git-status-types'

// RA: cached summaries must never publish another checkout's branch to a window.
it('shares a checkout summary across callers and refuses cross-checkout reuse', async () => {
  const main: GitStatusResult = { entries: [], conflictOperation: 'unknown', branch: 'main' }
  const feature: GitStatusResult = { entries: [], conflictOperation: 'unknown', branch: 'feature' }
  await readRepositoryGitSummary('local:summary-test', '/repo/main', async () => main)
  expect(
    await readRepositoryGitSummary('local:summary-test', '/repo/main', async () => feature)
  ).toMatchObject({ branch: 'main' })
  await expect(
    readRepositoryGitSummary('local:summary-test', '/repo/feature', async () => feature)
  ).rejects.toThrow('once per minute')
  expect(
    await readRepositoryGitSummary('remote:summary-test', '/repo/feature', async () => feature)
  ).toMatchObject({ branch: 'feature' })
})
