import { beforeEach, describe, expect, it, vi } from 'vitest'
import { create } from 'zustand'
import type { AppState } from '../../types'
import type { Repo } from '../../../../../shared/repo-types'
import { getDefaultSettings } from '../../../../../shared/constants'
import { createDetectedAgentsSlice } from './create-detected-agents-slice'

const detectAgents = vi.fn()
const refreshAgents = vi.fn()

globalThis.window = {
  api: {
    preflight: { detectAgents, refreshAgents },
    platform: { get: () => ({ platform: 'win32' }) }
  } as unknown as Window['api']
} as Window & typeof globalThis

function makeRepo(id: string): Repo {
  return {
    id,
    path: `C:\\${id}`,
    displayName: id,
    badgeColor: '#000000',
    addedAt: 0
  }
}

function createTestStore(repos: Repo[]) {
  const store = create<AppState>()(
    (...args) => createDetectedAgentsSlice(...args) as unknown as AppState
  )
  store.setState({
    repos,
    projects: repos.map((repo) => ({
      id: repo.id,
      displayName: repo.displayName,
      badgeColor: repo.badgeColor,
      sourceRepoIds: [repo.id],
      createdAt: 0,
      updatedAt: 0,
      localWindowsRuntimePreference: { kind: 'wsl' as const, distro: 'Ubuntu' }
    })),
    settings: {
      ...getDefaultSettings('/tmp'),
      localWindowsRuntimeDefault: { kind: 'windows-host' }
    },
    worktreesByRepo: {},
    activeRepoId: repos[0]?.id ?? null,
    activeWorktreeId: null
  })
  return store
}

describe('local detected agent context lifecycle', () => {
  beforeEach(() => {
    detectAgents.mockReset().mockResolvedValue(['claude'])
    refreshAgents.mockReset().mockResolvedValue({
      agents: ['codex'],
      pathSource: 'process_env',
      pathFailureReason: 'none'
    })
  })


  it('retries a refused list as a wake when an agent picker opens, without joining a background probe', async () => {
    const store = createTestStore([makeRepo('repo-1')])
    detectAgents.mockRejectedValueOnce(new Error("WSL distro 'Ubuntu' is not running."))
    await store.getState().ensureDetectedAgents()
    expect(store.getState().readLocalAgentInventory().state).toBe('failed')

    let finishBackground: (ids: string[]) => void = () => {}
    detectAgents
      .mockReturnValueOnce(
        new Promise<string[]>((resolve) => {
          finishBackground = resolve
        })
      )
      .mockResolvedValueOnce(['codex'])
    const background = store.getState().ensureDetectedAgents()
    const picker = store.getState().ensureDetectedAgentsForPicker()

    expect(detectAgents).toHaveBeenLastCalledWith(expect.objectContaining({ wakeWslDistro: true }))
    await expect(picker).resolves.toEqual(['codex'])
    // The background probe settles later but no longer owns the context.
    finishBackground([])
    await background
    expect(store.getState().readLocalAgentInventory()).toEqual({
      ids: ['codex'],
      state: 'successful'
    })
    // A known list is reused: opening the picker again probes nothing.
    detectAgents.mockClear()
    await store.getState().ensureDetectedAgentsForPicker()
    expect(detectAgents).not.toHaveBeenCalled()
  })



  it('failed full refresh settles both modes with detects finishing last', async () => {
    const store = createTestStore([])
    const enabledDetection = Promise.withResolvers<string[]>()
    const fullDetection = Promise.withResolvers<string[]>()
    const fullRefresh = Promise.withResolvers<{ agents: string[] }>()
    detectAgents
      .mockReturnValueOnce(enabledDetection.promise)
      .mockReturnValueOnce(fullDetection.promise)
    refreshAgents.mockReturnValueOnce(fullRefresh.promise)
    const enabled = store.getState().ensureDetectedAgents()
    const full = store.getState().ensureAllDetectedAgents()
    const refreshed = store.getState().refreshAllDetectedAgents()

    expect(store.getState().isDetectingAgents).toBe(false)
    expect(store.getState().isDetectingLocalAgentsByContext).toEqual({})
    expect(store.getState().isRefreshingLocalAgentsByContext).toEqual({
      host: true,
      'host\u0000all-agents': true
    })
    const finishDetections = async () => {
      enabledDetection.resolve(['claude'])
      fullDetection.resolve(['claude', 'kiro'])
      await Promise.all([enabled, full])
    }
    fullRefresh.reject(new Error('shell unavailable'))
    await refreshed
    await finishDetections()

    expect(store.getState().localDetectedAgentIdsByContext).toEqual({
      host: [],
      'host\u0000all-agents': []
    })
    expect(store.getState().isDetectingLocalAgentsByContext).toEqual({})
    expect(store.getState().isRefreshingLocalAgentsByContext).toEqual({})
    expect(store.getState().isDetectingAgents).toBe(false)
    expect(store.getState().isRefreshingAgents).toBe(false)
  })






  it('does not restore a project context cleared while detection is in flight', async () => {
    let resolveDetection: (agents: string[]) => void = () => {}
    detectAgents.mockReturnValueOnce(
      new Promise<string[]>((resolve) => {
        resolveDetection = resolve
      })
    )
    const store = createTestStore([makeRepo('repo-1')])

    const pending = store.getState().ensureDetectedAgents()
    store.getState().clearLocalDetectedAgentContextsForProjects(['repo-1'])
    resolveDetection(['claude'])

    await expect(pending).resolves.toEqual(['claude'])
    expect(store.getState().localDetectedAgentIdsByContext).toEqual({})
    expect(store.getState().isDetectingLocalAgentsByContext).toEqual({})
    expect(store.getState().detectedAgentIds).toBeNull()
  })

  it('does not let an older failed detect erase a successful refresh', async () => {
    let rejectDetection: (error: Error) => void = () => {}
    detectAgents.mockReturnValueOnce(
      new Promise<string[]>((_resolve, reject) => {
        rejectDetection = reject
      })
    )
    const store = createTestStore([])

    const detect = store.getState().ensureDetectedAgents()
    await expect(store.getState().refreshDetectedAgents()).resolves.toEqual(['codex'])
    rejectDetection(new Error('older detect failed'))
    await expect(detect).resolves.toEqual([])

    expect(store.getState().detectedAgentIds).toEqual(['codex'])
    expect(store.getState().localDetectedAgentIdsByContext.host).toEqual(['codex'])
    await expect(store.getState().ensureDetectedAgents()).resolves.toEqual(['codex'])
  })

})
