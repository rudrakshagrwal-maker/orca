import { bindPtyConnectionTestMocks } from '../test-fixtures/pty-connection-mocks.spec'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RESET_TERMINAL_CURSOR_STYLE } from '../../../../../../shared/terminal/protocol/input-modes/terminal-mode-reset-profiles'
import { makePaneKey } from '../../../../../../shared/workspace-layout/stable-pane-id'
import { flushAsyncTicks } from '../test-fixtures/pty-connection-test-async'
import { AGENT_TASK_COMPLETE_NOTIFICATION_MAX_WAIT_MS } from '../test-fixtures/pty-connection-test-constants'
import {
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
import {
  createInitialStoreState,
  buildActiveRuntimeEnvironmentState
} from '../test-fixtures/pty-connection-test-store-fixtures'
import type { StoreState } from '../test-fixtures/pty-connection-test-store-state'

import {
  installTerminalTestGlobals,
  loadFreshTerminalModules,
  restoreTerminalTestGlobals
} from '../test-fixtures/pty-connection-test-environment'

export function registerPtyConnectionHookCompletionSideEffectsTests(): void {
  let mockStoreState: StoreState
  let transportFactoryQueue: MockTransport[] = []
  let createdTransportOptions: Record<string, unknown>[] = []
  let storeSubscribers: ((state: StoreState) => void)[] = []

  function createDeps(overrides: Record<string, unknown> = {}) {
    return buildPaneConnectionDeps(() => mockStoreState, overrides)
  }

  // Why: activeRuntimeEnvironmentId exercises the remote-runtime path where the renderer still owns OSC 9999 status.
  function enableActiveRuntimeEnvironment(environmentId = 'env-1'): void {
    mockStoreState = buildActiveRuntimeEnvironmentState(mockStoreState, environmentId)
  }

  function notifyStoreSubscribers(): void {
    for (const listener of storeSubscribers.slice()) {
      listener(mockStoreState)
    }
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

    it('preserves a genuine hook completion after suppressing an earlier idle title', async () => {
      // The completion settings subscription is shared per module load.
      await loadFreshTerminalModules()
      const { connectPanePty } = await import('../connect-pane-pty')
      const agentTitleMocks2 = await vi.importMock<PtyConnectionAgentTitleMocks>(
        '@/lib/agent-status/aggregation/worktree-agent-status'
      )
      const transport = createMockTransport('pty-hook')
      transportFactoryQueue.push(transport)
      enableActiveRuntimeEnvironment()
      // A known server OS settles the pane's resize model, leaving only completion's subscriber.
      mockStoreState.runtimeStatusByEnvironmentId = new Map([
        ['env-1', { status: { hostPlatform: 'linux' as const }, checkedAt: 1 }]
      ])
      vi.useFakeTimers()
      const paneKey = makePaneKey('tab-1', LEAF_1)
      mockStoreState.agentStatusByPaneKey[paneKey] = {
        state: 'working',
        prompt: 'still working',
        updatedAt: Date.now(),
        stateStartedAt: Date.now(),
        agentType: 'claude',
        paneKey,
        stateHistory: []
      }

      const pane = createPane(1)
      const manager = createManager(1)
      const deps = createDeps()

      connectPanePty(
        pane as never,
        manager as never,
        bindPaneAgentTitleMocks(deps as never, agentTitleMocks2)
      )

      const titleHandler = createdTransportOptions[0]?.onTitleChange as
        | ((title: string, rawTitle: string) => void)
        | undefined
      const idleHandler = createdTransportOptions[0]?.onAgentBecameIdle as
        | ((title: string) => void)
        | undefined
      const statusHandler = createdTransportOptions[0]?.onAgentStatus as
        | ((payload: {
            state: 'done'
            prompt: string
            agentType: 'claude'
            lastAssistantMessage: string
          }) => void)
        | undefined
      if (!titleHandler || !idleHandler || !statusHandler) {
        throw new Error('Expected title, idle, and hook status handlers to be registered')
      }

      titleHandler('Claude working', 'Claude working')
      titleHandler('Claude done', 'Claude done')
      idleHandler('Claude done')
      vi.advanceTimersByTime(AGENT_TASK_COMPLETE_NOTIFICATION_MAX_WAIT_MS)

      expect(deps.dispatchNotification).not.toHaveBeenCalled()

      statusHandler({
        state: 'done',
        prompt: 'finish the implementation',
        agentType: 'claude',
        lastAssistantMessage: 'Done.'
      })
      notifyStoreSubscribers()
      expect(deps.setCacheTimerStartedAt).not.toHaveBeenCalledWith(paneKey, expect.any(Number))
      vi.advanceTimersByTime(AGENT_TASK_COMPLETE_NOTIFICATION_MAX_WAIT_MS * 2)

      expect(deps.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'agent-task-complete',
          paneKey,
          agentStatusSnapshot: expect.objectContaining({
            state: 'done',
            agentType: 'claude',
            lastAssistantMessage: 'Done.'
          })
        })
      )
      expect(deps.setCacheTimerStartedAt).toHaveBeenCalledWith(paneKey, expect.any(Number))
      expect(pane.terminal.write).toHaveBeenCalledWith(
        RESET_TERMINAL_CURSOR_STYLE,
        expect.any(Function)
      )
      expect(storeSubscribers).toHaveLength(1)
    })

    it('drops an exited agent completion when a replacement agent hook row is active', async () => {
      const { connectPanePty } = await import('../connect-pane-pty')
      const agentTitleMocks5 = await vi.importMock<PtyConnectionAgentTitleMocks>(
        '@/lib/agent-status/aggregation/worktree-agent-status'
      )
      const transport = createMockTransport('pty-replaced-codex')
      transportFactoryQueue.push(transport)
      vi.useFakeTimers()
      const getForegroundProcess = vi.mocked(window.api.pty.getForegroundProcess)
      getForegroundProcess.mockResolvedValue('codex')
      const paneKey = makePaneKey('tab-1', LEAF_1)
      const pane = createPane(1)
      const manager = createManager(1)
      const deps = createDeps()

      connectPanePty(
        pane as never,
        manager as never,
        bindPaneAgentTitleMocks(deps as never, agentTitleMocks5)
      )
      await flushAsyncTicks()
      const titleHandler = createdTransportOptions[0]?.onTitleChange as
        | ((title: string, rawTitle: string) => void)
        | undefined
      if (!titleHandler) {
        throw new Error('Expected onTitleChange to be registered')
      }

      titleHandler('Codex working', 'Codex working')
      await vi.advanceTimersByTimeAsync(2_500)
      mockStoreState.agentStatusByPaneKey[paneKey] = {
        state: 'working',
        prompt: 'replacement agent turn',
        updatedAt: Date.now(),
        stateStartedAt: Date.now(),
        agentType: 'claude',
        paneKey,
        stateHistory: []
      }
      getForegroundProcess.mockResolvedValue('claude')
      await vi.advanceTimersByTimeAsync(1_000)
      await vi.advanceTimersByTimeAsync(AGENT_TASK_COMPLETE_NOTIFICATION_MAX_WAIT_MS)

      expect(deps.dispatchNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({ source: 'agent-task-complete' })
      )
      expect(pane.terminal.write).not.toHaveBeenCalledWith(
        RESET_TERMINAL_CURSOR_STYLE,
        expect.any(Function)
      )

      mockStoreState.agentStatusByPaneKey[paneKey] = {
        state: 'done',
        prompt: 'replacement agent turn',
        updatedAt: Date.now(),
        stateStartedAt: Date.now(),
        agentType: 'claude',
        paneKey,
        stateHistory: []
      }
      titleHandler('Claude done', 'Claude done')
      await vi.advanceTimersByTimeAsync(AGENT_TASK_COMPLETE_NOTIFICATION_MAX_WAIT_MS)

      expect(deps.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'agent-task-complete',
          terminalTitle: 'Claude done',
          paneKey
        })
      )
    })

    it('preserves replacement-agent title side effects through the process replacement veto', async () => {
      const { dispatchAgentHookTerminalLifecycle } =
        await import('../../agent-completion/agent-hook-terminal-lifecycle')
      const { connectPanePty } = await import('../connect-pane-pty')
      const agentTitleMocks7 = await vi.importMock<PtyConnectionAgentTitleMocks>(
        '@/lib/agent-status/aggregation/worktree-agent-status'
      )
      const transport = createMockTransport('pty-replaced-codex')
      transportFactoryQueue.push(transport)
      vi.useFakeTimers()
      const getForegroundProcess = vi.mocked(window.api.pty.getForegroundProcess)
      getForegroundProcess.mockResolvedValue('codex')
      const paneKey = makePaneKey('tab-1', LEAF_1)
      const pane = createPane(1)
      const manager = createManager(1)
      const deps = createDeps()

      connectPanePty(
        pane as never,
        manager as never,
        bindPaneAgentTitleMocks(deps as never, agentTitleMocks7)
      )
      await flushAsyncTicks()
      const titleHandler = createdTransportOptions[0]?.onTitleChange as
        | ((title: string, rawTitle: string) => void)
        | undefined
      const idleHandler = createdTransportOptions[0]?.onAgentBecameIdle as
        | ((title: string) => void)
        | undefined
      if (!titleHandler || !idleHandler) {
        throw new Error('Expected title and idle handlers to be registered')
      }

      titleHandler('Codex working', 'Codex working')
      await vi.advanceTimersByTimeAsync(2_500)
      mockStoreState.agentStatusByPaneKey[paneKey] = {
        state: 'working',
        prompt: 'replacement agent turn',
        updatedAt: Date.now(),
        stateStartedAt: Date.now(),
        agentType: 'claude',
        paneKey,
        stateHistory: []
      }
      idleHandler('Claude done')
      getForegroundProcess.mockResolvedValue('claude')
      await vi.advanceTimersByTimeAsync(1_000)

      dispatchAgentHookTerminalLifecycle(paneKey, {
        state: 'done',
        prompt: 'replacement agent turn',
        agentType: 'claude',
        lastAssistantMessage: 'Done.'
      })

      expect(deps.setCacheTimerStartedAt).toHaveBeenCalledWith(paneKey, expect.any(Number))
      expect(pane.terminal.write).toHaveBeenCalledWith(
        RESET_TERMINAL_CURSOR_STYLE,
        expect.any(Function)
      )
    })
  })
}
