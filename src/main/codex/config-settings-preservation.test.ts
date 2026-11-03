import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { syncSystemConfigIntoManagedCodexHome } from './codex-config-mirror'
import { promoteCodexRuntimeSettingsToSystem } from './config-settings-promotion'
import { readCodexSettingsBaseline } from './config-settings-baseline'

vi.mock('./codex-daemon-socket-path-guard', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  applyCodexDaemonSocketGuard: (config: string) => config
}))

let root: string
let homes: { runtimeHomePath: string; systemHomePath: string }
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-readonly-settings-'))
  homes = { runtimeHomePath: join(root, 'runtime'), systemHomePath: join(root, 'system') }
  mkdirSync(homes.runtimeHomePath)
  mkdirSync(homes.systemHomePath)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

it('retains managed-session edits and removals across repeated syncs without writing system settings', () => {
  const source =
    'model = "before"\nmodel_reasoning_effort = "medium"\n\n[mcp_servers.local]\ncommand = "server"\n'
  const systemPath = join(homes.systemHomePath, 'config.toml')
  const runtimePath = join(homes.runtimeHomePath, 'config.toml')
  writeFileSync(systemPath, source)
  syncSystemConfigIntoManagedCodexHome(homes)
  const edited = readFileSync(runtimePath, 'utf8')
    .replace('model = "before"', 'model = "session-model"')
    .replace('model_reasoning_effort = "medium"\n', '')
  writeFileSync(runtimePath, edited)
  const ownership = readCodexSettingsBaseline(homes.runtimeHomePath)!
  const plan = promoteCodexRuntimeSettingsToSystem(homes)!
  expect(plan.runtimeValuesToPreserve.get('model')).toBe('"session-model"')
  expect(plan.runtimeValuesToPreserve.has('model_reasoning_effort')).toBe(true)
  expect(plan.runtimeValuesToPreserve.get('model_reasoning_effort')).toBeNull()
  expect(plan.mirroredMcpServers).toEqual(ownership.mcpServers)
  expect(plan.mirroredMcpServerRoot).toBe(ownership.mcpServerRoot)
  for (let pass = 0; pass < 3; pass += 1) {
    syncSystemConfigIntoManagedCodexHome(homes)
    expect(readFileSync(runtimePath, 'utf8')).toContain('model = "session-model"')
    expect(readFileSync(runtimePath, 'utf8')).not.toContain('model_reasoning_effort')
    expect(readFileSync(systemPath, 'utf8')).toBe(source)
  }
})

it('refuses ambiguous multiline settings without advancing the baseline', () => {
  const systemPath = join(homes.systemHomePath, 'config.toml')
  const runtimePath = join(homes.runtimeHomePath, 'config.toml')
  writeFileSync(systemPath, 'model = "before"\n')
  syncSystemConfigIntoManagedCodexHome(homes)
  const baselinePath = join(homes.runtimeHomePath, '.orca-config-settings-baseline.json')
  const baseline = readFileSync(baselinePath, 'utf8')
  const edited = 'model = """session\nmodel"""\n'
  writeFileSync(runtimePath, edited)
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    syncSystemConfigIntoManagedCodexHome(homes)
    expect(readFileSync(runtimePath, 'utf8')).toBe(edited)
    expect(readFileSync(baselinePath, 'utf8')).toBe(baseline)
    expect(readFileSync(systemPath, 'utf8')).toBe('model = "before"\n')
  } finally {
    warn.mockRestore()
  }
})
