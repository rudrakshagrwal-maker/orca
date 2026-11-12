import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../shared/repo-types'
import { openWorkspaceAtStartup } from './open-workspace-at-startup'

const mocks = vi.hoisted(() => {
  const repos: Repo[] = []
  return {
    platform: 'win32',
    pairedWeb: false,
    repos,
    tabsByWorktree: {} as Record<string, { id: string; ptyId: string | null }[]>,
    unifiedTabsByWorktree: {} as Record<string, { contentType: string }[]>,
    worktreesByRepo: {
      workspace: [
        { id: 'linked', isMainWorktree: false, hostId: 'local' },
        { id: 'remote-main', isMainWorktree: true, hostId: 'runtime:other' },
        { id: 'local-main', isMainWorktree: true, hostId: 'local' }
      ]
    },
    addRepoPath: vi.fn(),
    fetchWorktrees: vi.fn(),
    createTab: vi.fn(),
    activateAndRevealWorktree: vi.fn()
  }
})

vi.mock('../store', () => ({ useAppStore: { getState: () => mocks } }))
vi.mock('./app-window-chrome', () => ({
  get shortcutPlatform() {
    return mocks.platform
  }
}))
vi.mock('@/app-shell/chrome/desktop-window-chrome', () => ({ isPairedWebClientWindow: () => mocks.pairedWeb }))
vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorktree: mocks.activateAndRevealWorktree
}))

const repo: Repo = {
  id: 'workspace',
  path: 'c:/users/RUDRAKSH/documents/Workspace/',
  displayName: 'Workspace',
  badgeColor: '',
  addedAt: 0,
  kind: 'git'
}

// RA: Match path spelling without confusing local and remote owners or resurrecting cancelled boot.
describe('Workspace startup selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.platform = 'win32'
    mocks.pairedWeb = false
    mocks.repos = [repo]
    mocks.tabsByWorktree = {}
    mocks.unifiedTabsByWorktree = {}
    mocks.createTab.mockImplementation((worktreeId: string) => {
      mocks.tabsByWorktree[worktreeId] = [{ id: 'claude-tab', ptyId: null }]
      mocks.unifiedTabsByWorktree[worktreeId] = [{ contentType: 'terminal' }]
    })
    mocks.addRepoPath.mockResolvedValue(repo)
    mocks.fetchWorktrees.mockResolvedValue(true)
  })

  it('reuses a normalized local path and activates only its main worktree', async () => {
    await openWorkspaceAtStartup(() => false)
    expect(mocks.addRepoPath).not.toHaveBeenCalled()
    expect(mocks.activateAndRevealWorktree).toHaveBeenCalledExactlyOnceWith('local-main', {
      executionHostId: 'local',
      runtimeEnvironmentId: null,
      providesInitialSurface: true
    })
  })

  // RA: Restored terminal identity, including cold/no-PTY tabs, suppresses startup Claude.
  it('queues Claude in Workspace before activation and does not queue it twice', async () => {
    await openWorkspaceAtStartup(() => false)
    await openWorkspaceAtStartup(() => false)
    expect(mocks.createTab).toHaveBeenCalledExactlyOnceWith(
      'local-main',
      undefined,
      undefined,
      {
        launchAgent: 'claude',
        startupCwd: 'C:\\Users\\Rudraksh\\Documents\\Workspace',
        pendingStartup: { command: 'claude --dangerously-skip-permissions' },
        recordInteraction: false
      }
    )
    expect(mocks.createTab.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.activateAndRevealWorktree.mock.invocationCallOrder[0]!
    )
  })

  it.each(['legacy', 'unified'])('preserves a restored %s terminal', async (model) => {
    if (model === 'legacy') {
      mocks.tabsByWorktree['local-main'] = [{ id: 'restored', ptyId: null }]
    } else {
      mocks.unifiedTabsByWorktree['local-main'] = [{ contentType: 'terminal' }]
    }
    await openWorkspaceAtStartup(() => false)
    expect(mocks.createTab).not.toHaveBeenCalled()
  })

  it('opens Claude beside restored browser tabs when Workspace has no terminals', async () => {
    mocks.unifiedTabsByWorktree['local-main'] = [{ contentType: 'browser' }]
    await openWorkspaceAtStartup(() => false)
    expect(mocks.createTab).toHaveBeenCalledOnce()
  })

  it('adds Workspace locally when the only matching path belongs to a remote host', async () => {
    mocks.repos = [{ ...repo, executionHostId: 'runtime:other' }]
    await openWorkspaceAtStartup(() => false)
    expect(mocks.addRepoPath).toHaveBeenCalledExactlyOnceWith(
      'C:\\Users\\Rudraksh\\Documents\\Workspace',
      'git',
      { displayName: 'Workspace', runtimeEnvironmentId: null }
    )
    expect(mocks.fetchWorktrees).toHaveBeenCalledWith('workspace', { executionHostId: 'local' })
    expect(mocks.activateAndRevealWorktree).toHaveBeenCalledWith('local-main', expect.any(Object))
  })

  it.each(['darwin', 'linux'])('leaves %s restoration alone', async (platform) => {
    mocks.platform = platform
    await openWorkspaceAtStartup(() => false)
    expect(mocks.addRepoPath).not.toHaveBeenCalled()
    expect(mocks.fetchWorktrees).not.toHaveBeenCalled()
    expect(mocks.activateAndRevealWorktree).not.toHaveBeenCalled()
  })

  it('leaves paired Windows browser clients on their restored workspace', async () => {
    mocks.pairedWeb = true
    await openWorkspaceAtStartup(() => false)
    expect(mocks.fetchWorktrees).not.toHaveBeenCalled()
    expect(mocks.activateAndRevealWorktree).not.toHaveBeenCalled()
  })

  it('does not switch workspaces after the boot is cancelled during refresh', async () => {
    let cancelled = false
    mocks.fetchWorktrees.mockImplementationOnce(async () => {
      cancelled = true
    })
    await openWorkspaceAtStartup(() => cancelled)
    expect(mocks.activateAndRevealWorktree).not.toHaveBeenCalled()
    expect(mocks.createTab).not.toHaveBeenCalled()
  })
})
