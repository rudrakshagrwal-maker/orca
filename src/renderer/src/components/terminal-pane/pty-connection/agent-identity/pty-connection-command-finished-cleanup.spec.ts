import { bindPtyConnectionTestMocks } from '../test-fixtures/pty-connection-mocks.spec'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST_REPLAY_REATTACH_RESET } from '../../../../../../shared/terminal/protocol/input-modes/terminal-mode-reset-profiles'
import { TerminalKittyKeyboardModeTracker } from '../../../../../../shared/terminal/protocol/input-modes/terminal-kitty-keyboard-mode-tracker'
import { makePaneKey } from '../../../../../../shared/workspace-layout/stable-pane-id'
import { flushAsyncTicks, createDeferred } from '../test-fixtures/pty-connection-test-async'
import {
  LEAF_1,
  createMockTransport,
  createPane,
  captureCallbackTerminalWrites,
  createManager,
  type ConnectCallbacks,
  type MockTransport
} from '../test-fixtures/pty-connection-test-pane-fixtures'
import {
  resolveMockPaneWindowsShiftEnterEncoding,
  type StoreState
} from '../test-fixtures/pty-connection-test-store-state'
import {
  buildPaneConnectionDeps,
  type PtyConnectionAgentTitleMocks,
  bindPaneAgentTitleMocks
} from '../test-fixtures/pty-connection-test-deps'
import { createInitialStoreState } from '../test-fixtures/pty-connection-test-store-fixtures'
import {
  installTerminalTestGlobals,
  restoreTerminalTestGlobals
} from '../test-fixtures/pty-connection-test-environment'
import { mockPanePtyArgs } from '../test-fixtures/pty-connection-test-connect-mock-pane'

export function registerPtyConnectionCommandFinishedCleanupTests(): void {
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
    })

    afterEach(async () => {
      await restoreTerminalTestGlobals()
    })



    it.each([
      ['clears stale sleeping identity after a confirmed return to shell', false],
      // Hibernation records resume before kill; the exposed shell is Orca’s own stop rather than an independent agent exit.
      ['keeps sleeping identity when the shell surfaces during an intentional stop', true]
    ])('%s', async (_label, stoppingOnPurpose) => {
      vi.useFakeTimers()
      const { connectPanePty } = await import('../connect-pane-pty')
      const agentTitleMocks5 = await vi.importMock<PtyConnectionAgentTitleMocks>(
        '@/lib/agent-status/aggregation/worktree-agent-status'
      )
      vi.mocked(window.api.pty.confirmForegroundProcess).mockResolvedValue('zsh')
      const dataCallbackRef: { current: ((data: string) => void) | null } = { current: null }
      const ptyId = 'pty-sleeping-confirmed-shell'
      const transport = createMockTransport(ptyId)
      transport.connect.mockImplementation(
        async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
          dataCallbackRef.current = callbacks.onData ?? null
          return { id: ptyId }
        }
      )
      transportFactoryQueue.push(transport)
      const paneKey = makePaneKey('tab-1', LEAF_1)
      const deps = createDeps({ isVisibleRef: { current: true } })

      connectPanePty(
        ...mockPanePtyArgs(
          createPane(1),
          createManager(1),
          bindPaneAgentTitleMocks(deps, agentTitleMocks5)
        )
      )
      await vi.advanceTimersByTimeAsync(20)
      await flushAsyncTicks()
      mockStoreState.agentLaunchConfigByPaneKey[paneKey] = {
        launchConfig: { agentArgs: '', agentEnv: {} },
        identity: { agentType: 'codex' }
      }
      mockStoreState.sleepingAgentSessionsByPaneKey[paneKey] = {
        paneKey,
        worktreeId: 'wt-1',
        agent: 'codex',
        providerSession: { key: 'session_id', id: 'sess-1' },
        capturedAt: 1,
        updatedAt: 1
      }
      if (stoppingOnPurpose) {
        mockStoreState.suppressedPtyExitIds[ptyId] = true
      }

      dataCallbackRef.current?.('\x1b]133;D;0\x07')
      await vi.advanceTimersByTimeAsync(350)

      if (stoppingOnPurpose) {
        expect(mockStoreState.clearSleepingAgentSession).not.toHaveBeenCalled()
        expect(mockStoreState.sleepingAgentSessionsByPaneKey[paneKey]).toMatchObject({
          agent: 'codex'
        })
        expect(deps.onAgentExitedRef.current).not.toHaveBeenCalled()
      } else {
        expect(mockStoreState.clearSleepingAgentSession).toHaveBeenCalledExactlyOnceWith(paneKey)
        expect(mockStoreState.sleepingAgentSessionsByPaneKey[paneKey]).toBeUndefined()
        expect(deps.onAgentExitedRef.current).toHaveBeenCalledWith(LEAF_1)
      }
      expect(mockStoreState.paneForegroundAgentByPaneKey[paneKey]).toEqual({
        agent: null,
        shellForeground: true
      })
    })

    it('keeps sleeping identity when the foreground check still sees the agent', async () => {
      vi.useFakeTimers()
      const { connectPanePty } = await import('../connect-pane-pty')
      const agentTitleMocks6 = await vi.importMock<PtyConnectionAgentTitleMocks>(
        '@/lib/agent-status/aggregation/worktree-agent-status'
      )
      // Why both: the pane's process monitor reads the same foreground the confirm read sees.
      vi.mocked(window.api.pty.getForegroundProcess).mockResolvedValue('codex')
      const dataCallbackRef: { current: ((data: string) => void) | null } = { current: null }
      const ptyId = 'pty-sleeping-leaked-shell-marker'
      const transport = createMockTransport(ptyId)
      transport.connect.mockImplementation(
        async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
          dataCallbackRef.current = callbacks.onData ?? null
          return { id: ptyId }
        }
      )
      transportFactoryQueue.push(transport)
      const paneKey = makePaneKey('tab-1', LEAF_1)

      connectPanePty(
        ...mockPanePtyArgs(
          createPane(1),
          createManager(1),
          bindPaneAgentTitleMocks(
            createDeps({ isVisibleRef: { current: true } }),
            agentTitleMocks6
          )
        )
      )
      await vi.advanceTimersByTimeAsync(20)
      await flushAsyncTicks()
      mockStoreState.agentLaunchConfigByPaneKey[paneKey] = {
        launchConfig: { agentArgs: '', agentEnv: {} },
        identity: { agentType: 'codex' }
      }
      mockStoreState.sleepingAgentSessionsByPaneKey[paneKey] = {
        paneKey,
        worktreeId: 'wt-1',
        agent: 'codex',
        providerSession: { key: 'session_id', id: 'sess-1' },
        capturedAt: 1,
        updatedAt: 1
      }

      dataCallbackRef.current?.('\x1b]133;D;0\x07')
      await vi.advanceTimersByTimeAsync(350 + 1200 + 6000)
      await flushAsyncTicks()

      expect(mockStoreState.clearSleepingAgentSession).not.toHaveBeenCalled()
      expect(mockStoreState.sleepingAgentSessionsByPaneKey[paneKey]).toMatchObject({
        agent: 'codex'
      })
    })

    it('reconciles a pane that HAS a status row, whose own drop removes it first', async () => {
      // Use an accepted row to exercise deferred-drop bookkeeping before reconcile; the no-row path returns early.
      vi.useFakeTimers()
      const { connectPanePty } = await import('../connect-pane-pty')
      const agentTitleMocks7 = await vi.importMock<PtyConnectionAgentTitleMocks>(
        '@/lib/agent-status/aggregation/worktree-agent-status'
      )
      // Import dynamically to share pty-connection’s live registry; a static import can be a stale instance.
      const { createCommandFinishedStatusStore } =
        await import('./command-finished-status-store-test-fixture')
      vi.mocked(window.api.pty.confirmForegroundProcess).mockResolvedValue('powershell.exe')
      vi.mocked(window.api.agentStatus.reconcileEndedProcess).mockClear()
      const dataCallbackRef: { current: ((data: string) => void) | null } = { current: null }
      const ptyId = 'pty-claude-row-confirmed-shell'
      const transport = createMockTransport(ptyId)
      transport.connect.mockImplementation(
        async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
          dataCallbackRef.current = callbacks.onData ?? null
          return { id: ptyId }
        }
      )
      transportFactoryQueue.push(transport)
      const paneKey = makePaneKey('tab-1', LEAF_1)

      connectPanePty(
        ...mockPanePtyArgs(
          createPane(1),
          createManager(1),
          bindPaneAgentTitleMocks(
            createDeps({ isVisibleRef: { current: true } }),
            agentTitleMocks7
          )
        )
      )
      await vi.advanceTimersByTimeAsync(20)
      await flushAsyncTicks()

      // A real working write carries accepted-status bookkeeping and the latch present during STA-4612 exits.
      const realStore = createCommandFinishedStatusStore()
      const row = realStore.acceptWorkingClaudeStatus(paneKey)
      expect(row).toBeDefined()
      mockStoreState.agentStatusByPaneKey[paneKey] = row
      // Mirror both real dismissal and teardown to exercise drop-before-reconcile ordering.
      mockStoreState.dropAgentStatus.mockImplementation((key: string) => {
        delete mockStoreState.agentStatusByPaneKey[key]
        realStore.dropAgentStatus(key)
      })

      dataCallbackRef.current?.('\x1b]133;D;0\x07')
      await vi.advanceTimersByTimeAsync(350)

      expect(mockStoreState.dropAgentStatus).toHaveBeenCalledWith(paneKey)
      expect(realStore.getStatus(paneKey)).toBeUndefined()
      expect(window.api.agentStatus.reconcileEndedProcess).toHaveBeenCalledWith(paneKey)
    })




    it('keeps armed modes while the agent still owns the foreground after a leaked 133;D', async () => {
      vi.useFakeTimers()
      const { connectPanePty } = await import('../connect-pane-pty')
      const agentTitleMocks11 = await vi.importMock<PtyConnectionAgentTitleMocks>(
        '@/lib/agent-status/aggregation/worktree-agent-status'
      )
      // Why both: the pane's process monitor reads the same foreground the confirm read sees.
      vi.mocked(window.api.pty.getForegroundProcess).mockResolvedValue('droid')
      const dataCallbackRef: { current: ((data: string) => void) | null } = { current: null }
      const ptyId = 'pty-stale-mode-live-agent'
      const transport = createMockTransport(ptyId)
      transport.connect.mockImplementation(
        async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
          dataCallbackRef.current = callbacks.onData ?? null
          return { id: ptyId }
        }
      )
      transportFactoryQueue.push(transport)
      const paneKey = makePaneKey('tab-1', LEAF_1)
      const pane = createPane(1)
      const { writes } = captureCallbackTerminalWrites(pane)
      const deps = createDeps({ isVisibleRef: { current: true } })

      connectPanePty(
        ...mockPanePtyArgs(pane, createManager(1), bindPaneAgentTitleMocks(deps, agentTitleMocks11))
      )
      await vi.advanceTimersByTimeAsync(20)
      await flushAsyncTicks()
      mockStoreState.agentLaunchConfigByPaneKey[paneKey] = {
        launchConfig: { agentArgs: '', agentEnv: {} },
        identity: { agentType: 'droid' }
      }

      dataCallbackRef.current?.('\x1b[>5u')
      // Nested-shell 133;D leaves the agent foreground, so its mouse/Kitty modes must survive confirmation.
      dataCallbackRef.current?.('\x1b]133;D;0\x07')
      await vi.advanceTimersByTimeAsync(350 + 1200 + 6000)
      await flushAsyncTicks()

      expect(writes.some((w) => w.includes(POST_REPLAY_REATTACH_RESET))).toBe(false)
      expect(deps.paneKittyKeyboardModesRef.current.get(pane.id)?.flags).toBe(5)
    })


  })
}
