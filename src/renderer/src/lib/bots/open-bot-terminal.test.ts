// RA: Bot clicks use one local terminal/startup owner, including native folder workspaces.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotProfile } from '../../../../shared/bot-profile-types'
const mocks = vi.hoisted(() => ({
  activeWorkspaceKey: 'folder:notes',
  activeWorktreeId: null,
  activeWorkspaceExecutionHostId: 'local',
  repos: [{ id: 'workspace', path: 'C:/Users/Rudraksh/Documents/Workspace', executionHostId: 'local' }],
  worktreesByRepo: { workspace: [{ id: 'local-workspace', path: 'C:/Users/Rudraksh/Documents/Workspace', isMainWorktree: true, hostId: 'local' }] },
  folderWorkspaces: [],
  createTab: vi.fn((_workspace: string, _group: unknown, _shell: string, _options: unknown) => ({ id: 'bot-tab' })),
  setTabCustomTitle: vi.fn(),
  activate: vi.fn(),
  launch: vi.fn(),
  select: vi.fn()
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks } }))
vi.mock('@/store/workspaces/selection/workspace-host-target', () => ({ selectWorkspaceByHostTarget: (...args: unknown[]) => mocks.select(...args) }))
vi.mock('@/lib/workspace/ownership/connection-owner-resolution', () => ({ getConnectionIdFromState: () => null }))
vi.mock('@/lib/workspace/activation/worktree-activation', () => ({ activateAndRevealWorkspace: mocks.activate }))
import { openBotTerminal } from './open-bot-terminal'
const profile: BotProfile = { key: 'hermes:hermes@100.65.84.89:default', id: 'default', label: 'Hermes / default', source: 'hermes', home: '/home/hermes', application: 'remote TUI' }
describe('opening bot terminals', () => {
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.activeWorkspaceExecutionHostId = 'local'
    mocks.select.mockImplementation((_state, target: { id: string }) => ({ id: target.id, path: target.id === 'local-workspace' ? 'C:/Users/Rudraksh/Documents/Workspace' : 'C:/Notes' }))
    mocks.launch.mockResolvedValue({ command: 'fixed-main-command', shell: 'powershell.exe', label: 'Hermes / default', identity: { key: profile.key, id: 'default', source: 'hermes', home: '/home/hermes' } })
    vi.stubGlobal('window', { api: { bots: { launch: mocks.launch } } })
  })
  it('opens a local folder tab with its startup atomically queued', async () => {
    await openBotTerminal(profile)
    expect(mocks.createTab).toHaveBeenCalledExactlyOnceWith('folder:notes', undefined, 'powershell.exe', {
      startupCwd: 'C:/Notes', forceHostRuntime: true, quickCommandLabel: 'Hermes / default',
      botProfile: { key: 'hermes:hermes@100.65.84.89:default', id: 'default', source: 'hermes', home: '/home/hermes' },
      pendingStartup: { command: 'fixed-main-command', env: undefined }
    })
    expect(mocks.activate).toHaveBeenCalledWith('folder:notes', { executionHostId: 'local', providesInitialSurface: true })
  })
  it('routes a click from a remote workspace into the existing local Workspace', async () => {
    mocks.activeWorkspaceExecutionHostId = 'runtime:remote'
    await openBotTerminal(profile)
    expect(mocks.createTab).toHaveBeenCalledWith('local-workspace', undefined, 'powershell.exe', expect.objectContaining({ startupCwd: 'C:/Users/Rudraksh/Documents/Workspace', forceHostRuntime: true }))
  })
  it('does not create a bare tab when main refuses the profile', async () => {
    mocks.launch.mockRejectedValue(new Error('Unknown profile'))
    await expect(openBotTerminal(profile)).rejects.toThrow('Unknown profile')
    expect(mocks.createTab).not.toHaveBeenCalled()
  })
})
