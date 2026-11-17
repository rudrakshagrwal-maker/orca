import { bindPtyConnectionTestMocks } from '../test-fixtures/pty-connection-mocks.spec'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makePaneKey } from '../../../../../../shared/workspace-layout/stable-pane-id'
import { flushAsyncTicks } from '../test-fixtures/pty-connection-test-async'
import { sendTerminalInputThroughPane } from '../test-fixtures/pty-connection-test-dom'
import {
  LEAF_1,
  createMockTransport,
  createPane,
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

export function registerPtyConnectionForegroundAgentRoutingTests(): void {
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





    it('confirms a delayed Claude from fresh startup output after the first read window expires', async () => {
      vi.useFakeTimers()
      const { connectPanePty } = await import('../connect-pane-pty')
      const agentTitleMocks8 = await vi.importMock<PtyConnectionAgentTitleMocks>(
        '@/lib/agent-status/aggregation/worktree-agent-status'
      )
      let foreground = 'sleep'
      vi.mocked(window.api.pty.getForegroundProcess).mockImplementation(async () => foreground)
      vi.mocked(window.api.pty.confirmForegroundProcess).mockImplementation(async () => foreground)
      const tabId = 'tab-delayed-claude'
      const ptyId = 'pty-delayed-claude'
      const paneKey = makePaneKey(tabId, LEAF_1)
      transportFactoryQueue.push(createMockTransport(ptyId))
      const binding = connectPanePty(
        ...mockPanePtyArgs(
          createPane(1),
          createManager(1),
          bindPaneAgentTitleMocks(
            createDeps({ tabId, startup: { command: 'sleep 30 && claude' } }),
            agentTitleMocks8
          )
        )
      )
      await vi.advanceTimersByTimeAsync(30_000)
      expect(mockStoreState.paneForegroundAgentByPaneKey[paneKey]?.agent).not.toBe('claude')

      foreground = 'claude'
      const onTitleChange = createdTransportOptions[0]?.onTitleChange
      if (typeof onTitleChange !== 'function') {
        throw new Error('Missing live title consumer')
      }
      // Captured with capture-agent-pty-transcript.mjs from a real delayed Claude launch.
      onTitleChange('✳ Claude Code', '✳ Claude Code')
      await vi.advanceTimersByTimeAsync(350)
      expect(mockStoreState.paneForegroundAgentByPaneKey[paneKey]).toMatchObject({
        agent: 'claude',
        agentEvidence: 'process-read',
        routingTrusted: true
      })
      binding.dispose()
    })



    it('never promotes typed Droid text when foreground enrichment is unavailable', async () => {
      vi.useFakeTimers()
      const { connectPanePty } = await import('../connect-pane-pty')
      const agentTitleMocks11 = await vi.importMock<PtyConnectionAgentTitleMocks>(
        '@/lib/agent-status/aggregation/worktree-agent-status'
      )
      vi.mocked(window.api.pty.confirmForegroundProcess)
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error('inspection unavailable'))
        .mockResolvedValueOnce(null)
      const dataCallbackRef: { current: ((data: string) => void) | null } = { current: null }
      const pane = createPane(1)
      const ptyId = 'pty-typed-droid-unavailable-start'
      const tabId = 'tab-typed-droid-unavailable-start'
      const paneKey = makePaneKey(tabId, LEAF_1)
      const transport = createMockTransport(ptyId)
      transport.connect.mockImplementation(
        async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
          dataCallbackRef.current = callbacks.onData ?? null
          return { id: ptyId }
        }
      )
      transportFactoryQueue.push(transport)

      connectPanePty(
        ...mockPanePtyArgs(
          pane,
          createManager(1),
          bindPaneAgentTitleMocks(
            createDeps({ tabId, isVisibleRef: { current: false } }),
            agentTitleMocks11
          )
        )
      )
      await vi.advanceTimersByTimeAsync(20)
      await flushAsyncTicks()

      sendTerminalInputThroughPane(pane, 'droid\r')
      dataCallbackRef.current?.('\x1b]133;C\x07')
      await vi.advanceTimersByTimeAsync(350)
      expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')

      await vi.advanceTimersByTimeAsync(1200)
      expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')

      await vi.advanceTimersByTimeAsync(5999)
      expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')
      await vi.advanceTimersByTimeAsync(1)

      expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, paneKey)).toBe('alt-enter')
    })
  })
}
