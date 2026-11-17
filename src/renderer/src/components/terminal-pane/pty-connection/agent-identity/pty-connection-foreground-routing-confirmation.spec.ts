import { bindPtyConnectionTestMocks } from '../test-fixtures/pty-connection-mocks.spec'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makePaneKey } from '../../../../../../shared/workspace-layout/stable-pane-id'
import type { TuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent'
import { flushAsyncTicks } from '../test-fixtures/pty-connection-test-async'
import {
  LEAF_1,
  createMockTransport,
  createPane,
  createManager,
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

export function registerPtyConnectionForegroundRoutingConfirmationTests(): void {
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

    describe('foreground routing confirmation authority', () => {
      // Use unique tab IDs to isolate published identity from sibling tests sharing LEAF_1.
      async function connectRestoredPaneForForegroundSampling(
        args: {
          ptyId?: string
          tabId?: string
          isVisibleRef?: { current: boolean }
          launchConfig?: {
            agentCommand?: string
            agentArgs: string
            agentEnv: Record<string, string>
          }
          launchAgent?: TuiAgent
        } = {}
      ): Promise<{
        binding: {
          noteVisibilityResume: () => void
          sampleForegroundAgentOnFocus: () => void
          requestWindowsShiftEnterReconfirmation: () => void
        }
        deps: ReturnType<typeof createDeps>
        transport: MockTransport
        cacheKey: string
      }> {
        const { connectPanePty } = await import('../connect-pane-pty')
        const agentTitleMocks = await vi.importMock<PtyConnectionAgentTitleMocks>(
          '@/lib/agent-status/aggregation/worktree-agent-status'
        )
        const ptyId = args.ptyId ?? 'tab-pty'
        const tabId = args.tabId ?? `tab-${ptyId}`
        const hasReattachMetadata =
          args.launchConfig !== undefined || args.launchAgent !== undefined
        const transport = createMockTransport(hasReattachMetadata ? null : ptyId)
        let connectedPtyId: string | null = hasReattachMetadata ? null : ptyId
        transport.getPtyId.mockImplementation(() => connectedPtyId)
        transport.connect.mockImplementation(async ({ sessionId }: { sessionId?: string }) => {
          connectedPtyId = sessionId ?? null
          return sessionId
            ? {
                id: sessionId,
                ...(args.launchConfig ? { launchConfig: args.launchConfig } : {}),
                ...(args.launchAgent ? { launchAgent: args.launchAgent } : {})
              }
            : null
        })
        transportFactoryQueue.push(transport)
        const deps = createDeps({
          tabId,
          restoredLeafId: LEAF_1,
          restoredPtyIdByLeafId: { [LEAF_1]: ptyId },
          ...(args.isVisibleRef ? { isVisibleRef: args.isVisibleRef } : {})
        })
        const binding = connectPanePty(
          createPane(1) as never,
          createManager(1) as never,
          bindPaneAgentTitleMocks(deps as never, agentTitleMocks)
        )
        await vi.advanceTimersByTimeAsync(20)
        await flushAsyncTicks(20)
        return { binding, deps, transport, cacheKey: makePaneKey(tabId, LEAF_1) }
      }


      it('does not reauthorize explicitly revoked routing before confirmation', async () => {
        vi.useFakeTimers()
        const ptyId = 'pty-pi-revoked-focus'
        const tabId = `tab-${ptyId}`
        const { binding, cacheKey } = await connectRestoredPaneForForegroundSampling({
          ptyId,
          tabId
        })
        mockStoreState.paneForegroundAgentByPaneKey[cacheKey] = {
          agent: 'pi',
          routingRevoked: true,
          shellForeground: false
        }

        binding.sampleForegroundAgentOnFocus()

        expect(mockStoreState.paneForegroundAgentByPaneKey[cacheKey]).toEqual({
          agent: 'pi',
          routingRevoked: true,
          shellForeground: false
        })
        expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, cacheKey)).toBe('alt-enter')
      })


    })
  })
}
