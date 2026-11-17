import { temporarilySetNavigatorUserAgent } from '../test-fixtures/pty-connection-test-dom'
import { bindPtyConnectionTestMocks } from '../test-fixtures/pty-connection-mocks.spec'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushAsyncTicks } from '../test-fixtures/pty-connection-test-async'
import {
  createMockTransport,
  createPane,
  createManager,
  type ConnectCallbacks,
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
  loadFreshTerminalModules,
  restoreTerminalTestGlobals
} from '../test-fixtures/pty-connection-test-environment'
import { mockPanePtyArgs } from '../test-fixtures/pty-connection-test-connect-mock-pane'

export function registerPtyConnectionForegroundFrameSchedulingTests(): void {
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

    it('clears the synchronized latch when ConPTY splits the frame end marker', async () => {
      // Split DEC 2026 closes must release the foreground latch or later output freezes until blur (#8754).
      const restoreNavigator = temporarilySetNavigatorUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      )
      await loadFreshTerminalModules()
      try {
        const { connectPanePty } = await import('../connect-pane-pty')
        const agentTitleMocks10 = await vi.importMock<PtyConnectionAgentTitleMocks>(
          '@/lib/agent-status/aggregation/worktree-agent-status'
        )
        const transport = createMockTransport()
        const capturedDataCallback: { current: ((data: string) => void) | null } = { current: null }
        transport.connect.mockImplementation(
          async ({ callbacks }: { callbacks: ConnectCallbacks }) => {
            capturedDataCallback.current = callbacks.onData ?? null
            return 'pty-id'
          }
        )
        transportFactoryQueue.push(transport)

        const pane = createPane(1)
        connectPanePty(
          ...mockPanePtyArgs(
            pane,
            createManager(1),
            bindPaneAgentTitleMocks(createDeps(), agentTitleMocks10)
          )
        )
        await flushAsyncTicks(6)

        vi.useFakeTimers()
        const repaintBody = 'codex spinner '.repeat(200)
        capturedDataCallback.current?.(`\x1b[?2026h${repaintBody}`)
        vi.advanceTimersByTime(300)
        pane.terminal.write.mockClear()

        capturedDataCallback.current?.(`${repaintBody}\x1b[?25l\x1b[13;14H\x1b[?25h\x1b[?202`)
        capturedDataCallback.current?.('6l')
        vi.advanceTimersByTime(1100)
        expect(pane.terminal.write).toHaveBeenCalled()
        pane.terminal.write.mockClear()

        capturedDataCallback.current?.('command finished\r\n')
        vi.advanceTimersByTime(20)
        expect(pane.terminal.write).toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
        restoreNavigator()
      }
    })

    // RA: removed the timer/write-count assertion; public echo/FIFO behavior is covered by scheduler tests.
  })
}
