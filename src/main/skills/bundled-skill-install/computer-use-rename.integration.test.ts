import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SKILL_INSTALL_PROVIDERS } from '../../../shared/skill-install-providers'
import { BUNDLED_SKILL_SOURCES } from './bundled-skill-sources'

import { makeSkillHome, removeSkillHomes, writeCopy } from './testing/bundled-skill-home'
import { clearSkillRootScanCache, discoverSkills } from '../discovery/skill-native-discovery'

const NAME = 'orca-computer-use'
const OLD = 'computer-use'
const FIXTURE = join(import.meta.dirname, 'computer-use-before-rename.skill-md.txt')
// RA: inherited Orca provider overrides must not make fixture discovery read the real home.
beforeEach(() => {
  for (const provider of SKILL_INSTALL_PROVIDERS) {
    if (provider.homeEnv) vi.stubEnv(provider.homeEnv, undefined)
  }
  vi.stubEnv('HERMES_HOME', undefined)
})
afterEach(async () => {
  vi.unstubAllEnvs()
  clearSkillRootScanCache()
  await removeSkillHomes()
})

describe('released computer-use installation migration', () => {
})
