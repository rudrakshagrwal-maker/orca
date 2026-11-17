import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import type * as NodeOsModule from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeAppEnvironment } from '../../../../../config/scripts/test-runtime/environment/vitest-host-ports-setup'

const state = vi.hoisted(() => ({ home: '' }))

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeOsModule>()
  return { ...actual, default: actual, homedir: () => state.home }
})

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/orca-user-data' } }))

import { MANAGED_AGENT_HOOK_SCRIPT_REFRESHERS } from '../managed-agent-hook-registry'

describe('managed hook script refresh and owned profile cleanup', () => {
  beforeEach(async () => {
    state.home = await mkdtemp(join(tmpdir(), 'orca-hook-refresh-main-thread-'))
    vi.stubEnv('CLAUDE_CONFIG_DIR', join(state.home, '.claude'))
    installFakeAppEnvironment({ getPath: () => join(state.home, 'user-data') })
    vi.stubEnv('ORCA_USER_DATA_PATH', join(state.home, 'user-data'))
    vi.stubEnv('GROK_HOME', undefined)
    vi.stubEnv('KIMI_CODE_HOME', undefined)
    vi.stubEnv('XDG_CONFIG_HOME', undefined)
  })

  afterEach(async () => {
    await rm(state.home, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

})
