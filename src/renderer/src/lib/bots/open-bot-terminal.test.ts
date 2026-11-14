// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BotProfile } from '../../../../shared/bot-profile-types'
const mocks = vi.hoisted(() => ({
  activeWorkspaceKey: 'folder:notes',
  activeWorktreeId: null,
  activeWorkspaceExecutionHostId: 'local',
  activeGroupIdByWorktree: { 'folder:notes': 'group' },
  launch: vi.fn(),
  open: vi.fn(),
  settle: vi.fn(),
  select: vi.fn(),
  connection: vi.fn()
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks } }))
vi.mock('@/store/workspaces/selection/workspace-host-target', () => ({
  selectWorkspaceByHostTarget: (...args: unknown[]) => mocks.select(...args)
}))
vi.mock('@/lib/workspace/ownership/connection-owner-resolution', () => ({
  getConnectionIdFromState: () => mocks.connection()
}))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab', () => ({
  launchAgentInNewTabWithOutcome: mocks.open
}))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab-host-agents', () => ({
  settleAgentTabLaunch: mocks.settle
}))
import { openBotTerminal } from './open-bot-terminal'
const profile: BotProfile = {
  key: 'hermes:local:default',
  id: 'default',
  label: 'Hermes',
  source: 'hermes',
  home: '/local/hermes',
  application: 'local TUI'
}

describe('opening local bot terminals', () => {
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.activeWorkspaceExecutionHostId = 'local'
    mocks.select.mockReturnValue({ id: 'folder:notes', path: '/home/ra/notes' })
    mocks.connection.mockReturnValue(null)
    mocks.launch.mockResolvedValue({
      agentArgs: '-p default --tui --resume recent',
      label: 'Hermes'
    })
    mocks.open.mockReturnValue({ surface: { kind: 'local-terminal', tabId: 'bot-tab' } })
    mocks.settle.mockResolvedValue({ kind: 'terminal' })
    vi.stubGlobal('api', { bots: { launch: mocks.launch } })
  })
  it('uses the existing Hermes launch path in the active folder workspace on any platform', async () => {
    await openBotTerminal(profile)
    expect(mocks.open).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'hermes',
        worktreeId: 'folder:notes',
        workspaceExecutionHostId: 'local',
        requestedSurface: 'terminal',
        initialCwd: '/home/ra/notes',
        agentArgs: '-p default --tui --resume recent',
        actionAgentArgs: '-p default --tui --resume recent',
        quickCommandLabel: 'Hermes',
        groupId: 'group'
      }),
      false
    )
  })
  it('passes the new-chat choice through main validation', async () => {
    await openBotTerminal(profile, null)
    expect(mocks.launch).toHaveBeenCalledWith('hermes:local:default', null)
  })
  it('does not route local profiles into remote workspaces', async () => {
    mocks.activeWorkspaceExecutionHostId = 'runtime:remote'
    await expect(openBotTerminal(profile)).rejects.toThrow('Select a local workspace')
    expect(mocks.open).not.toHaveBeenCalled()
    expect(mocks.launch).not.toHaveBeenCalled()
  })
  it('does not open a tab when main refuses a stale profile', async () => {
    mocks.launch.mockRejectedValue(new Error('Unknown profile'))
    await expect(openBotTerminal(profile)).rejects.toThrow('Unknown profile')
    expect(mocks.open).not.toHaveBeenCalled()
  })
  it('rechecks workspace existence after main replies', async () => {
    mocks.select
      .mockReturnValueOnce({ id: 'folder:notes', path: '/notes' })
      .mockReturnValueOnce(undefined)
    await expect(openBotTerminal(profile)).rejects.toThrow('removed before launch')
    expect(mocks.open).not.toHaveBeenCalled()
  })
  it('reports a launch refusal', async () => {
    mocks.settle.mockResolvedValue({ kind: 'failed' })
    await expect(openBotTerminal(profile)).rejects.toThrow('Could not launch Hermes')
  })
  it('reports a synchronous launch refusal', async () => {
    mocks.open.mockReturnValue({ refused: { delivered: false, failureNotified: false } })
    await expect(openBotTerminal(profile)).rejects.toThrow('Could not launch Hermes')
  })
})
