import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, it, onTestFinished } from 'vitest'
import { preserveGlobalAgentConfiguration } from '../../shared/fork-background-policy'
import { writeCanonicalOpenCodePluginAtomically } from '../../shared/opencode-plugin-atomic-write'
import { writeTomlConfigAtomically } from '../codex/configuration/toml/config-toml-atomic-write'
import { writeHooksJsonAsync } from './installation/configuration/hooks-json-write-async'

// RA: exercise actual production guards against disposable agent homes, never the real home.
it('leaves agent configuration bytes and sibling files untouched', async () => {
  const home = mkdtempSync(join(tmpdir(), 'orca-fork-agent-config-'))
  onTestFinished(() => rmSync(home, { recursive: true, force: true }))
  expect(preserveGlobalAgentConfiguration()).toBe(true)
  const claude = join(home, '.claude', 'settings.json')
  const codex = join(home, '.codex', 'config.toml')
  const plugin = join(home, '.config', 'opencode', 'plugins', 'status.js')
  const originals = new Map([
    [claude, '{"userOwned":true}\n'],
    [codex, 'model = "user-choice"\n'],
    [plugin, 'export default {}\n']
  ])
  for (const [path, text] of originals) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
  }
  // RA: Claude's observer owns the synchronous writer; generic async installs remain forbidden.
  await writeHooksJsonAsync(claude, { hooks: {} })
  writeTomlConfigAtomically(codex, 'model = "overwritten"')
  writeCanonicalOpenCodePluginAtomically(plugin, 'overwritten')
  for (const [path, text] of originals) {
    expect(readFileSync(path, 'utf8')).toBe(text)
    const fileName = path === claude ? 'settings.json' : path === codex ? 'config.toml' : 'status.js'
    expect(readdirSync(dirname(path))).toEqual([fileName])
  }
})
