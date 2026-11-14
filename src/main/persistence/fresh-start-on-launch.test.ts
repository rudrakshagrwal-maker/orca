import { describe, expect, it } from 'vitest'
import { getDefaultSettings, getDefaultWorkspaceSession } from '../../shared/constants'
import { normalizeExecutionHostId, type ExecutionHostId } from '../../shared/execution-host'
import type { WorkspaceSessionState } from '../../shared/workspace-session/workspace-session-state-types'
import { createFreshStartOnLaunchGate } from './fresh-start-on-launch'

function savedSession(): WorkspaceSessionState {
  return {
    ...getDefaultWorkspaceSession(),
    activeRepoId: 'project',
    activeWorktreeId: 'project::/work',
    activeWorkspaceKey: 'worktree:project::/work',
    activeWorkspaceExecutionHostId: 'local',
    activeTabId: 'old-terminal',
    tabsByWorktree: {
      'project::/work': [
        {
          id: 'old-terminal',
          ptyId: 'old-pty',
          worktreeId: 'project::/work',
          title: 'Old Claude',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1,
          launchAgent: 'claude'
        }
      ]
    },
    terminalLayoutsByTabId: {
      'old-terminal': {
        root: { type: 'leaf', leafId: 'old-pane' },
        ptyIdsByLeafId: { 'old-pane': 'old-pty' },
        activeLeafId: 'old-pane',
        expandedLeafId: null
      }
    },
    openFilesByWorktree: {
      'project::/work': [
        {
          filePath: '/work/a.ts',
          relativePath: 'a.ts',
          worktreeId: 'project::/work',
          language: 'typescript'
        }
      ]
    },
    unifiedTabs: {
      'project::/work': [
        {
          id: 'old-chat',
          entityId: 'conversation',
          groupId: 'group',
          worktreeId: 'project::/work',
          contentType: 'agent-session',
          label: 'Chat',
          customLabel: null,
          color: null,
          sortOrder: 1,
          createdAt: 1
        }
      ]
    },
    activeConnectionIdsAtShutdown: ['server'],
    terminalTopologyRevisionByRepoId: { project: 9 },
    remoteSessionIdsByTabId: { 'old-terminal': 'old-remote-pty' },
    browserUrlHistory: [
      {
        url: 'https://example.org',
        normalizedUrl: 'https://example.org',
        title: 'Docs',
        lastVisitedAt: 1,
        visitCount: 2
      }
    ],
    lastVisitedAtByWorktreeId: { 'project::/work': 12 }
  }
}

function fixture(enabled?: boolean, stop = async () => {}) {
  const settings = { ...getDefaultSettings('/home/test'), freshStartOnLaunch: enabled }
  const sessions = new Map<ExecutionHostId, WorkspaceSessionState>([
    ['local', savedSession()],
    ['ssh:server', savedSession()]
  ])
  const gate = createFreshStartOnLaunchGate(
    {
      getSettings: () => settings,
      getWorkspaceSessionHostIds: () => [...sessions.keys()],
      getWorkspaceSession: (hostId) => sessions.get(normalizeExecutionHostId(hostId) ?? 'local')!,
      setWorkspaceSession: (session, hostId) => {
        sessions.set(normalizeExecutionHostId(hostId) ?? 'local', session)
      },
      flushPendingOrThrowAsync: async () => {}
    },
    stop
  )
  return { gate, sessions, settings }
}

describe('fresh start at the saved-session restore gate', () => {
  it('waits for previous processes to stop before removing every partition’s surfaces', async () => {
    let finish = () => {}
    const stopped = new Promise<void>((resolve) => {
      finish = resolve
    })
    const { gate, sessions } = fixture(undefined, () => stopped)
    const pending = gate.prepare()
    expect(sessions.get('local')?.activeTabId).toBe('old-terminal')
    finish()
    await pending
    for (const session of sessions.values()) {
      expect(session.tabsByWorktree).toEqual({})
      expect(session.terminalLayoutsByTabId).toEqual({})
      expect(session.openFilesByWorktree).toEqual({})
      expect(session.unifiedTabs).toBeUndefined()
      expect(session.remoteSessionIdsByTabId).toBeUndefined()
      expect(session.activeConnectionIdsAtShutdown).toBeUndefined()
      expect(session.activeTabId).toBeNull()
      expect(session.activeWorktreeId).toBe('project::/work')
      expect(session.activeRepoId).toBe('project')
      expect(session.lastVisitedAtByWorktreeId).toEqual({ 'project::/work': 12 })
      expect(session.browserUrlHistory).toEqual([
        {
          url: 'https://example.org',
          normalizedUrl: 'https://example.org',
          title: 'Docs',
          lastVisitedAt: 1,
          visitCount: 2
        }
      ])
    }
  })

  it('leaves restore untouched when disabled, including processes', async () => {
    const { gate, sessions, settings } = fixture(false, async () => {
      throw new Error('Must not stop processes')
    })
    await gate.prepare()
    expect(sessions.get('local')?.activeTabId).toBe('old-terminal')
    settings.freshStartOnLaunch = true
    expect(await gate.claimLaunch()).toBe(false)
    expect(sessions.get('ssh:server')?.tabsByWorktree['project::/work']?.[0]?.ptyId).toBe('old-pty')
  })

  it('grants one Claude launch and preserves this run’s tabs on reload/reconnect', async () => {
    const { gate, sessions } = fixture(true)
    expect(await gate.claimLaunch(false)).toBe(true)
    expect(await gate.claimLaunch(false)).toBe(true)
    expect(await Promise.all([gate.claimLaunch(), gate.claimLaunch()])).toEqual([true, false])
    sessions.set('local', { ...savedSession(), activeTabId: 'this-run' })
    await gate.prepare()
    expect(await gate.claimLaunch()).toBe(false)
    expect(sessions.get('local')?.activeTabId).toBe('this-run')
  })

  it('keeps saved surfaces and refuses launch when stopping previous sessions fails', async () => {
    const { gate, sessions } = fixture(true, async () => {
      throw new Error('Daemon unavailable')
    })
    await expect(gate.prepare()).rejects.toThrow('Daemon unavailable')
    await expect(gate.claimLaunch()).rejects.toThrow('Daemon unavailable')
    expect(sessions.get('local')?.activeTabId).toBe('old-terminal')
  })
})
