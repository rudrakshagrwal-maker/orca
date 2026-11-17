import { expect, it, vi } from 'vitest'
const stream = vi.hoisted(() => ({ args: [] as string[] }))
vi.mock('../runner', () => ({
  gitOptionalLocksDisabledEnv: () => ({}),
  gitStreamStdout: async (args: string[], options: { onStdout: (chunk: string) => void }) => {
    stream.args = args
    options.onStdout(
      '# branch.oid 1234567890\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +2 -1\n'
    )
    return { stoppedEarly: false }
  }
}))
import { readStatusPorcelain } from './status-porcelain-stream'

// RA: sidebar reads must never opt back into an untracked-directory scan.
it('uses tracked-only porcelain v2 while retaining branch and ahead/behind information', async () => {
  const result = await readStatusPorcelain('/repo', { summaryOnly: true }, 1000)
  expect(stream.args).toEqual([
    '-c',
    'core.quotePath=false',
    'status',
    '--porcelain=v2',
    '--branch',
    '-uno'
  ])
  expect(result.parser.branch).toMatchObject({
    branch: 'refs/heads/main',
    upstreamName: 'origin/main',
    upstreamAheadBehind: { ahead: 2, behind: 1 }
  })
})
