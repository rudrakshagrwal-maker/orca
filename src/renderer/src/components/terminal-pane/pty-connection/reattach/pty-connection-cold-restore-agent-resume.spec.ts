import { mockPanePtyArgs } from '../test-fixtures/pty-connection-test-connect-mock-pane'
import { bindPtyConnectionTestMocks } from '../test-fixtures/pty-connection-mocks.spec'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makePaneKey } from '../../../../../../shared/workspace-layout/stable-pane-id'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../../../../../shared/layout-owner-switch'
import {
  expectWindowPaintsColdRestoreOnly,
  mainLayoutApplyTransport
} from '../test-fixtures/pty-connection-test-main-pane-start-fixtures'
import { RESET_GRAPHIC_RENDITION } from '../../../../../../shared/terminal/protocol/input-modes/terminal-mode-reset-profiles'
import { flushAsyncTicks } from '../test-fixtures/pty-connection-test-async'
import { UUID_RE } from '../test-fixtures/pty-connection-test-constants'
import {
  terminalWriteText,
  LEAF_1,
  createMockTransport,
  createPane,
  createManager,
  type MockTransport
} from '../test-fixtures/pty-connection-test-pane-fixtures'
import {
  buildPaneConnectionDeps,
  type PtyConnectionAgentTitleMocks,
  bindPaneAgentTitleMocks
} from '../test-fixtures/pty-connection-test-deps'
import { createInitialStoreState } from '../test-fixtures/pty-connection-test-store-fixtures'
import type { StoreState } from '../test-fixtures/pty-connection-test-store-state'

import {
  installTerminalTestGlobals,
  restoreTerminalTestGlobals
} from '../test-fixtures/pty-connection-test-environment'

export function registerPtyConnectionColdRestoreAgentResumeTests(): void {
  let mockStoreState: StoreState
  let transportFactoryQueue: MockTransport[] = []
  let createdTransportOptions: Record<string, unknown>[] = []
  let storeSubscribers: ((state: StoreState) => void)[] = []

  function createDeps(overrides: Record<string, unknown> = {}) {
    return buildPaneConnectionDeps(() => mockStoreState, overrides)
  }

  describe('connectPanePty', () => {
    beforeEach(async () => {
      vi.clearAllMocks()
      transportFactoryQueue = []
      createdTransportOptions = []
      storeSubscribers = []
      mockStoreState = createInitialStoreState(() => mockStoreState)
      bindPtyConnectionTestMocks({
        getState: () => mockStoreState,
        getTransportQueue: () => transportFactoryQueue,
        getTransportOptions: () => createdTransportOptions,
        getStoreSubscribers: () => storeSubscribers,
        setStoreSubscribers: (subscribers) => {
          storeSubscribers = subscribers
        }
      })
      await installTerminalTestGlobals()
      ;(await mainLayoutApplyTransport()).reset()
    })

    afterEach(async () => {
      await restoreTerminalTestGlobals()
    })


    it('does not choose a non-exact legacy record when same-tab provider sessions differ', async () => {
      vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
      const { connectPanePty } = await import('../connect-pane-pty')
      const agentTitleMocks6 = await vi.importMock<PtyConnectionAgentTitleMocks>(
        '@/lib/agent-status/aggregation/worktree-agent-status'
      )
      const transport = createMockTransport('fresh-pty')
      transport.connect.mockImplementation(async ({ sessionId }: { sessionId?: string }) => {
        if (sessionId) {
          return {
            id: 'fresh-pty',
            coldRestore: { scrollback: 'cold-payload', cwd: '/tmp/wt-1' }
          }
        }
        return 'fresh-pty'
      })
      transportFactoryQueue.push(transport)
      const firstLegacyPaneKey = 'tab-1:2'
      const secondLegacyPaneKey = 'tab-1:3'
      mockStoreState = {
        ...mockStoreState,
        tabsByWorktree: {
          'wt-1': [{ id: 'tab-1', ptyId: 'lost-pty' }]
        },
        settings: {
          ...mockStoreState.settings,
          agentCmdOverrides: {}
        },
        agentStatusByPaneKey: {},
        sleepingAgentSessionsByPaneKey: {
          [firstLegacyPaneKey]: {
            paneKey: firstLegacyPaneKey,
            tabId: 'tab-1',
            worktreeId: 'wt-1',
            agent: 'codex',
            providerSession: { key: 'session_id', id: 'codex-session-1' },
            prompt: 'finish the task',
            state: 'working',
            capturedAt: 1,
            updatedAt: 1
          },
          [secondLegacyPaneKey]: {
            paneKey: secondLegacyPaneKey,
            tabId: 'tab-1',
            worktreeId: 'wt-1',
            agent: 'codex',
            providerSession: { key: 'session_id', id: 'codex-session-2' },
            prompt: 'finish another task',
            state: 'working',
            capturedAt: 2,
            updatedAt: 2
          }
        }
      } as StoreState

      const pane = createPane(1)
      const manager = createManager(1)
      const deps = createDeps({
        restoredLeafId: LEAF_1,
        restoredPtyIdByLeafId: { [LEAF_1]: 'lost-pty' }
      })

      connectPanePty(
        pane as never,
        manager as never,
        bindPaneAgentTitleMocks(deps as never, agentTitleMocks6)
      )
      await flushAsyncTicks(20)
      await vi.advanceTimersByTimeAsync(70)

      expect(pane.terminal.write).toHaveBeenCalledWith(
        `${RESET_GRAPHIC_RENDITION}cold-payload`,
        expect.any(Function)
      )
      expect(deps.onShowSessionRestoredBanner).not.toHaveBeenCalled()
      expect(transport.connect).not.toHaveBeenCalledWith(
        expect.objectContaining({ command: expect.stringContaining('resume') })
      )
      expect(mockStoreState.clearSleepingAgentSession).not.toHaveBeenCalled()
    })
  })
}
