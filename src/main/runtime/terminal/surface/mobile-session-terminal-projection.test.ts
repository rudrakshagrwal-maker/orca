import { expect, it } from 'vitest'
import type { WorkspaceSessionState } from '../../../../shared/workspace-session/workspace-session-state-types'
import { findPersistedTerminalPane } from './mobile-session-terminal-projection'

// RA: restore admission must not inherit a tab-wide agent identity onto a split plain shell.
it('classifies a sole saved agent but keeps split shells free of inherited launch identity', () => {
  const session: WorkspaceSessionState = {
    activeRepoId: null,
    activeWorktreeId: 'folder',
    activeTabId: 'tab',
    tabsByWorktree: {
      folder: [
        {
          id: 'tab',
          ptyId: null,
          worktreeId: 'folder',
          title: 'Claude',
          customTitle: null,
          color: null,
          createdAt: 1,
          sortOrder: 0,
          launchAgent: 'claude'
        }
      ]
    },
    terminalLayoutsByTabId: {
      tab: {
        root: { type: 'leaf', leafId: '11111111-1111-4111-8111-111111111111' },
        activeLeafId: '11111111-1111-4111-8111-111111111111',
        expandedLeafId: null
      }
    }
  }
  expect(
    findPersistedTerminalPane(session, {
      worktreeId: 'folder',
      tabId: 'tab',
      leafId: '11111111-1111-4111-8111-111111111111'
    })?.launchAgent
  ).toBe('claude')
  session.terminalLayoutsByTabId.tab.root = {
    type: 'split',
    direction: 'horizontal',
    first: { type: 'leaf', leafId: '11111111-1111-4111-8111-111111111111' },
    second: { type: 'leaf', leafId: '22222222-2222-4222-8222-222222222222' }
  }
  const shell = findPersistedTerminalPane(session, {
    worktreeId: 'folder',
    tabId: 'tab',
    leafId: '22222222-2222-4222-8222-222222222222'
  })
  expect(shell).toMatchObject({
    parentTabId: 'tab',
    leafId: '22222222-2222-4222-8222-222222222222'
  })
  expect(shell?.launchAgent).toBeUndefined()
})
