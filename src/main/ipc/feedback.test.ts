// RA: both legacy feedback and crash-submit paths must fail locally before any transport loads.
import { expect, it, vi } from 'vitest'
import { submitFeedback } from './feedback'
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  net: {
    fetch: () => {
      throw new Error('unexpected outbound request')
    }
  }
}))
it.each(['feedback', 'crash'] as const)('keeps %s submission local', async (submissionType) => {
  await expect(
    submitFeedback({
      feedback: 'local evidence',
      githubLogin: null,
      githubEmail: null,
      submitAnonymously: true,
      submissionType
    })
  ).resolves.toEqual({
    ok: false,
    status: null,
    error: 'Feedback uploads are disabled in local-only Orca'
  })
})
