import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Worktree } from '../../../shared/worktree/types'
import type { ExecutionHostId } from '../../../shared/execution-host'
import { openFreshStartAtStartup } from './open-fresh-start-at-startup'

const mocks = vi.hoisted(() => ({
  state: {
    activeWorkspaceKey: null as `worktree:${string}` | `folder:${string}` | null,
    activeWorktreeId: null as string | null,
    activeWorkspaceExecutionHostId: null as ExecutionHostId | null,
    repos: [{ id: 'first', executionHostId: 'local', path: '/first' }],
    worktreesByRepo: {} as Record<string, Partial<Worktree>[]>,
    fetchWorktrees: vi.fn()
  },
  selectedWorkspace: undefined as Partial<Worktree> | undefined,
  launch: vi.fn(),
  activate: vi.fn(),
  settle: vi.fn()
}))

vi.mock('../store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('@/store/workspaces/selection/workspace-host-target', () => ({
  selectWorkspaceByHostTarget: () => mocks.selectedWorkspace
}))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab', () => ({
  launchAgentInNewTabWithOutcome: mocks.launch
}))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab-host-agents', () => ({
  settleAgentTabLaunch: mocks.settle
}))
vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorkspaceWithOutcome: mocks.activate
}))

beforeEach(() => {
  vi.stubGlobal('window', { api: { session: { claimFreshStart: async () => true } } })
  vi.clearAllMocks()
  mocks.state.activeWorkspaceKey = 'worktree:current'
  mocks.state.activeWorktreeId = 'current'
  mocks.state.activeWorkspaceExecutionHostId = 'local'
  mocks.selectedWorkspace = { id: 'current', path: '/current' }
  mocks.state.repos = [{ id: 'first', executionHostId: 'local', path: '/first' }]
  mocks.state.worktreesByRepo = {}
  mocks.activate.mockReturnValue({ opened: { primaryTabId: null } })
  mocks.settle.mockResolvedValue({ kind: 'terminal' })
})

afterEach(() => vi.unstubAllGlobals())

it('launches one Claude through the agent path in the last active workspace', async () => {
  await openFreshStartAtStartup(() => false)
  expect(mocks.launch).toHaveBeenCalledExactlyOnceWith({
    requestId: expect.any(String),
    agent: 'claude',
    requestedSurface: 'terminal',
    worktreeId: 'current',
    workspaceExecutionHostId: 'local',
    selectedExecutionHostId: 'local',
    initialCwd: '/current',
    pendingActivationSpawn: true
  })
  expect(mocks.activate).toHaveBeenCalledExactlyOnceWith('current', {
    executionHostId: 'local',
    providesInitialSurface: true
  })
})

it('keeps a folder workspace on its owning remote host', async () => {
  mocks.selectedWorkspace = { id: 'folder:notes', path: '/notes' }
  await openFreshStartAtStartup(() => false, {
    activeWorkspaceKey: 'folder:notes',
    activeWorktreeId: null,
    activeWorkspaceExecutionHostId: 'ssh:box'
  })
  expect(mocks.launch).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      agent: 'claude',
      worktreeId: 'folder:notes',
      workspaceExecutionHostId: 'ssh:box',
      initialCwd: '/notes'
    })
  )
})

it('falls back to the first project’s primary worktree on that project’s host', async () => {
  mocks.selectedWorkspace = undefined
  mocks.state.repos = [{ id: 'first', executionHostId: 'runtime:box', path: '/first' }]
  mocks.state.worktreesByRepo = {
    first: [
      { id: 'linked', isMainWorktree: false, hostId: 'runtime:box', path: '/linked' },
      { id: 'wrong-host', isMainWorktree: true, hostId: 'local', path: '/wrong' },
      { id: 'primary', isMainWorktree: true, hostId: 'runtime:box', path: '/first' }
    ]
  }
  await openFreshStartAtStartup(() => false)
  expect(mocks.launch).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      agent: 'claude',
      worktreeId: 'primary',
      workspaceExecutionHostId: 'runtime:box',
      initialCwd: '/first'
    })
  )
})

it('does not launch after cancellation during worktree discovery', async () => {
  mocks.selectedWorkspace = undefined
  let cancelled = false
  mocks.state.worktreesByRepo = { first: [{ id: 'primary', isMainWorktree: true, path: '/first' }] }
  mocks.state.fetchWorktrees.mockImplementationOnce(async () => {
    cancelled = true
  })
  await openFreshStartAtStartup(() => cancelled)
  expect(mocks.launch).not.toHaveBeenCalled()
})

it('reports a refused Claude launch instead of completing startup successfully', async () => {
  mocks.settle.mockResolvedValueOnce({ kind: 'cancelled' })
  await expect(openFreshStartAtStartup(() => false)).rejects.toThrow(
    'Could not launch Claude for fresh start'
  )
})
