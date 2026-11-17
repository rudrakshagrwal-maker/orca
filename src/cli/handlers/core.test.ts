import { describe, expect, it, vi } from 'vitest'

const { reclaimStaleLockMock, printReclaimResultMock } = vi.hoisted(() => ({
  reclaimStaleLockMock: vi.fn(),
  printReclaimResultMock: vi.fn()
}))

vi.mock('../../main/orcad/orcad-stale-lock-reclaim.js', () => ({
  reclaimStaleOrcadInstanceLock: reclaimStaleLockMock,
  printOrcadStaleLockReclaimResult: printReclaimResultMock
}))

// Exclude the socket runtime graph; this handler needs only errors and serveOrcaApp.
vi.mock('../runtime-client', () => ({
  RuntimeClientError: class RuntimeClientError extends Error {
    readonly code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
  serveOrcaApp: vi.fn()
}))

import { CORE_HANDLERS } from './core'
import type { HandlerContext } from '../dispatch'
import type { RuntimeClient } from '../runtime-client'

describe('orca serve stale-lock validation', () => {
  const client = {} as RuntimeClient

  // #32177: an empty --data-root must never fall back to the default profile's lock.
  it('refuses `orca serve --reclaim-stale-lock` with a --data-root that names no directory', async () => {
    const ctx: HandlerContext = {
      flags: new Map<string, string | boolean>([
        ['reclaim-stale-lock', true],
        ['data-root', true],
        ['yes', true]
      ]),
      client,
      cwd: '/tmp',
      json: true,
      rawArgs: []
    }
    await expect(CORE_HANDLERS.serve(ctx)).rejects.toMatchObject({
      code: 'invalid_argument',
      message:
        '--data-root expects a directory. Usage: orca serve --reclaim-stale-lock [--data-root <dir>] [--yes] [--json]'
    })
    expect(reclaimStaleLockMock).not.toHaveBeenCalled()
    expect(printReclaimResultMock).not.toHaveBeenCalled()
  })
})
