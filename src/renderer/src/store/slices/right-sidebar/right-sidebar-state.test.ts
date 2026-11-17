import { describe, expect, it } from 'vitest'
import type { AppState } from '../../types'
import type { EditorSet } from '../editor/types/editor-set-get'
import { createRightSidebarState } from './right-sidebar-state'

function createState(legacyOpen: boolean): () => AppState {
  let state: AppState
  const set: EditorSet = (update) => {
    state = { ...state, ...(typeof update === 'function' ? update(state) : update) }
  }
  state = {
    ...createRightSidebarState(set, () => state),
    rightSidebarOpen: legacyOpen,
    rightSidebarTab: 'source-control',
    sidebarOpen: false,
    activeWorktreeId: 'workspace',
    collapsedGroups: new Set(['ra:sidebar-files', 'repo:other']),
    fileSearchStateByWorktree: {},
    setCollapsedGroups: (groups: Set<string>) => set({ collapsedGroups: groups })
  } as AppState
  return () => state
}

describe('left Files reveal', () => {
  it.each([true, false])('reveals Files with legacy right-sidebar open=%s', (legacyOpen) => {
    const get = createState(legacyOpen)
    get().showRightSidebarFiles()

    expect(get().sidebarOpen).toBe(true)
    expect([...get().collapsedGroups]).toEqual(['repo:other'])
    expect(get().rightSidebarExplorerView).toBe('files')
    expect(get().rightSidebarOpen).toBe(legacyOpen)
  })

  it('reveals content search in Files with the requested folder scope', () => {
    const get = createState(false)
    get().showRightSidebarSearch({ query: 'needle', includePattern: 'src/**' })

    expect(get().sidebarOpen).toBe(true)
    expect([...get().collapsedGroups]).toEqual(['repo:other'])
    expect(get().rightSidebarExplorerView).toBe('search')
    expect(get().fileSearchStateByWorktree.workspace).toMatchObject({
      query: 'needle',
      includePattern: 'src/**'
    })
  })
})
