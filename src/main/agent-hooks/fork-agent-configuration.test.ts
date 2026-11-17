import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, it, onTestFinished } from 'vitest'
import { preserveGlobalAgentConfiguration } from '../../shared/fork-background-policy'
import { writeCanonicalOpenCodePluginAtomically } from '../../shared/opencode-plugin-atomic-write'
import { writeTomlConfigAtomically } from '../codex/configuration/toml/config-toml-atomic-write'
import { writeHooksJsonAsync } from './installation/configuration/hooks-json-write-async'

// RA: exercise actual production guards against disposable agent homes, never the real home.
