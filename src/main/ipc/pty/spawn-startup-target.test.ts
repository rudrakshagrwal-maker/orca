import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { resolveTerminalStartupCwd } from '../../../shared/shell/launch/terminal-startup-cwd'
import { keepsRestoredAgentCwd, resolvePtySpawnStartupTarget } from './spawn-startup-target'

vi.mock('@orca/process-host', () => ({ runProcess: vi.fn(), runProcessSync: vi.fn() })) // RA: workspace package is not linked in this worktree

vi.mock('@orca/process-host/windows-system-binary', () => ({ windowsSystem32Binary: vi.fn() }))

const root = mkdtempSync(join(tmpdir(), 'orca-cwd-'))

function target(keepMissingCwd: boolean, remoteHost = false) {
  const missing = join(root, 'gone')
  return resolvePtySpawnStartupTarget({
    worktreeId: undefined,
    cwd: missing,
    sessionId: undefined,
    shellOverride: undefined,
    projectRuntimeSource: { kind: 'sent', projectRuntime: undefined },
    preAdopted: false,
    getSettings: undefined,
    keepMissingCwd,
    remoteHost,
    resolveStartupCwd: (_id, cwd, fallback) => resolveTerminalStartupCwd(root, cwd, fallback)
  }).then((t) => ({ t, missing }))
}

describe('restored agent cwd', () => {
  it('plain shells fall back to the workspace root', async () => {
    const { t } = await target(false)
    expect(t.cwd).toBe(root)
    expect(t.correctStartupCwd).toBe(root)
  })

  it('a restored agent with a proven-missing cwd fails with a stable code, never falling back', async () => {
    await expect(target(true)).rejects.toThrow('startup_cwd_missing')
  })

  it('a restored agent on a remote host keeps its cwd and saves no correction', async () => {
    const { t, missing } = await target(true, true)
    expect(t.cwd?.replaceAll(/[\\/]/g, '/')).toBe(missing.replaceAll(/[\\/]/g, '/'))
    expect(t.correctStartupCwd).toBeUndefined()
    expect(t.startupCwdFallback).toBeUndefined()
    rmSync(root, { recursive: true, force: true })
  })

  it('a saved-pane relaunch keeps the cwd without any spawnIntent', () => {
    expect(keepsRestoredAgentCwd({ keepMissingCwd: true })).toBe(true)
  })

  it('only restore-intent agent spawns keep the cwd', () => {
    expect(keepsRestoredAgentCwd({ spawnIntent: 'automatic-restore', launchAgent: 'claude' })).toBe(true)
    expect(keepsRestoredAgentCwd({ spawnIntent: 'user-resume', resumeProviderSession: {} })).toBe(true)
    expect(keepsRestoredAgentCwd({ launchAgent: 'claude' })).toBe(false)
    expect(keepsRestoredAgentCwd({ spawnIntent: 'automatic-restore' })).toBe(false)
  })
})
