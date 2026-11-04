import { afterEach, describe, expect, it, vi } from 'vitest'

const { commandGraph } = vi.hoisted(() => ({ commandGraph: vi.fn() }))
vi.mock('./command-main', () => {
  commandGraph()
  return { main: vi.fn() }
})
import { main } from './index'

// RA: root help must not even evaluate dispatch or runtime discovery, regardless of ambient flags.
describe('root short help', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it.each([{ argv: [] }, { argv: ['--help'] }, { argv: ['-h'] }, { argv: ['help'] }])(
    'prints core help without loading command code for $argv',
    async ({ argv }) => {
      vi.stubEnv('ORCA_ENVIRONMENT', 'stale-server')
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      await main(argv)
      const text = String(log.mock.calls[0]?.[0])
      expect(text.split('\n').length).toBeLessThan(30)
      expect(text).toContain('orca help --all for everything')
      for (const command of ['open', 'terminal list', 'agent launch', 'worktree create', 'project']) {
        expect(text).toContain(command)
      }
      for (const removed of ['account', 'skills share', 'mobile', 'pairing', 'cloud']) {
        expect(text).not.toContain(removed)
      }
      expect(commandGraph).not.toHaveBeenCalled()
    }
  )
})
