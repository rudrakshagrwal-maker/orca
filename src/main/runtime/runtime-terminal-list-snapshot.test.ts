import { describe, expect, it, vi } from 'vitest'
import { RuntimeTerminalList, sleepingTerminalLeaf } from './terminal/query/runtime-terminal-list'
import type { RuntimeTerminalSummary } from '../../shared/runtime-types'
import type { RuntimeLeafRecord, RuntimePtyWorktreeRecord } from './terminal/records/runtime-terminal-state-records'
import type { ResolvedWorktree } from './workspaces/catalog/runtime-worktree-path-identity'

const WORKTREE = 'repo::/repo'
const worktree = { id: WORKTREE, path: '/repo', branch: 'main' } as ResolvedWorktree

// RA: exercise the saved-state path with a live terminal and an unmounted sleeping sibling.
function fixture() {
  const leaves = [
    { tabId: 'live', leafId: 'one', worktreeId: WORKTREE, ptyId: 'pty-live' },
    { tabId: 'sleep', leafId: 'two', worktreeId: WORKTREE, ptyId: null }
  ] as RuntimeLeafRecord[]
  const refreshPtys = vi.fn(async () => null)
  const getWorktreeMap = vi.fn(async () => new Map([[WORKTREE, worktree]]))
  const deps: ConstructorParameters<typeof RuntimeTerminalList>[0] = {
    getGraphEpoch: () => 1,
    assertGraphEpoch: vi.fn(),
    getExplicitWorktreeId: (selector) => (selector === `id:${WORKTREE}` ? WORKTREE : null),
    getResolvedCache: () => null,
    buildWorktreeFromId: () => worktree,
    resolveWorktree: async () => worktree,
    listKnownWorktrees: () => [worktree],
    getWorktreeMap,
    refreshPtys,
    getPtys: () => [
      { ptyId: 'pty-live', worktreeId: WORKTREE, connected: true } as RuntimePtyWorktreeRecord
    ],
    getLeaves: () => leaves,
    buildLeafSummary: (leaf) => ({
      handle: `term_${leaf.tabId}`,
      ptyId: leaf.ptyId,
      worktreeId: WORKTREE,
      worktreePath: '/repo',
      branch: 'main',
      tabId: leaf.tabId,
      leafId: leaf.leafId,
      title: leaf.tabId,
      connected: Boolean(leaf.ptyId),
      writable: Boolean(leaf.ptyId),
      lastOutputAt: null,
      preview: ''
    }),
    buildPtySummary: vi.fn<() => RuntimeTerminalSummary>(),
    getSnapshots: () => new Map(),
    getTabTitle: () => null,
    getTopologyRevision: () => 1,
    buildHostScope: () => ({ hostIds: ['local'], omittedHostIds: [] }),
    displayDetails: (terminal) => ({
      createdAt: 1000,
      state: terminal.ptyId ? 'working' : 'sleeping'
    })
  }
  return { list: new RuntimeTerminalList(deps), refreshPtys, getWorktreeMap, deps }
}

describe('terminal saved-state listing', () => {
  it('lists sleeping siblings and display facts without git scans or PTY inventory', async () => {
    const { list, refreshPtys, getWorktreeMap } = fixture()
    const result = await list.list(undefined, 100, { snapshot: true, includeVisualLayouts: false })
    expect(
      result.terminals.map(({ title, state, createdAt }) => ({ title, state, createdAt }))
    ).toEqual([
      { title: 'live', state: 'working', createdAt: 1000 },
      { title: 'sleep', state: 'sleeping', createdAt: 1000 }
    ])
    expect(refreshPtys).not.toHaveBeenCalled()
    expect(getWorktreeMap).not.toHaveBeenCalled()
    expect(result.visualLayouts).toBeUndefined()
  })

  it('keeps the legacy JSON row shape and inventory behaviour', async () => {
    const { list, refreshPtys, getWorktreeMap } = fixture()
    const result = await list.list(undefined, 100, { includeVisualLayouts: false })
    expect(result.terminals).toHaveLength(1)
    expect(result.terminals[0]).not.toHaveProperty('state')
    expect(result.terminals[0]).not.toHaveProperty('createdAt')
    expect(refreshPtys).toHaveBeenCalledTimes(1)
    expect(getWorktreeMap).toHaveBeenCalledTimes(1)
  })

  it('includes unmounted saved sleepers once, without registering a process or changing the graph', async () => {
    const { list, deps, refreshPtys } = fixture()
    const saved = sleepingTerminalLeaf({
      worktreeId: WORKTREE,
      tabId: 'unmounted',
      leafId: 'three',
      title: 'Cook'
    })
    expect(saved).toMatchObject({ paneTitle: 'Cook', ptyId: null, connected: false, writable: false })
    const graphBefore = [...deps.getLeaves()]
    deps.getSleepingLeaves = () => [saved, saved, graphBefore[1]]
    const result = await list.list(undefined, 100, { snapshot: true, includeVisualLayouts: false })
    expect(result.terminals.map((terminal) => terminal.tabId)).toEqual(['live', 'sleep', 'unmounted'])
    expect(result.terminals[2]).toMatchObject({ ptyId: null, writable: false, state: 'sleeping' })
    expect([...deps.getLeaves()]).toEqual(graphBefore)
    expect(refreshPtys).not.toHaveBeenCalled()
  })

  it('never treats a saved-state request as fresh liveness evidence', async () => {
    const { list, refreshPtys } = fixture()
    await expect(
      list.list(undefined, 100, { snapshot: true, requireFreshPtyLiveness: true })
    ).rejects.toThrow('terminal_liveness_unavailable')
    expect(refreshPtys).toHaveBeenCalledTimes(1)
  })

  it('retains explicit worktree filtering', async () => {
    const { list, deps } = fixture()
    deps.getLeaves = () => [
      { tabId: 'other', leafId: 'x', worktreeId: 'repo::/other', ptyId: null } as RuntimeLeafRecord
    ]
    deps.getPtys = () => []
    expect((await list.list(`id:${WORKTREE}`, 100, { snapshot: true })).terminals).toEqual([])
  })
})
