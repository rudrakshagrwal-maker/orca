import { bindPtyConnectionTestMocks } from '../test-fixtures/pty-connection-mocks.spec'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makePaneKey } from '../../../../../../shared/workspace-layout/stable-pane-id'
import type { TuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent'
import { flushAsyncTicks } from '../test-fixtures/pty-connection-test-async'
import {
  VISIBLE_PTY_SETTLE_MS,
  WRAPPER_RESOLVE_RETRY_MS,
  SECOND_WRAPPER_RETRY_MS
} from '../test-fixtures/pty-connection-test-constants'
import { temporarilySetNavigatorUserAgent } from '../test-fixtures/pty-connection-test-dom'
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
  loadFreshTerminalModules,
  restoreTerminalTestGlobals
} from '../test-fixtures/pty-connection-test-environment'

export function registerPtyConnectionForegroundAgentSamplingTests(): void {
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

    describe('visible foreground agent sampling (perf)', () => {
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

      async function advanceVisibleForegroundRead(): Promise<void> {
        await vi.advanceTimersByTimeAsync(VISIBLE_PTY_SETTLE_MS)
        await flushAsyncTicks()
      }

      function foregroundReadCallsFor(ptyId: string): unknown[][] {
        return vi
          .mocked(window.api.pty.getForegroundProcess)
          .mock.calls.filter(([calledPtyId]) => calledPtyId === ptyId)
      }






      it('retires stale daemon launch identity when warm reattach finds the shell', async () => {
        vi.useFakeTimers()
        vi.mocked(window.api.pty.confirmForegroundProcess).mockResolvedValue('powershell.exe')
        const ptyId = 'pty-stale-daemon-launch-identity'
        const tabId = `tab-${ptyId}`
        mockStoreState.tabsByWorktree = { 'wt-1': [{ id: tabId, ptyId }] }

        const { cacheKey } = await connectRestoredPaneForForegroundSampling({
          ptyId,
          tabId,
          launchAgent: 'droid'
        })
        expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, cacheKey)).toBe('alt-enter')

        await vi.advanceTimersByTimeAsync(
          VISIBLE_PTY_SETTLE_MS + WRAPPER_RESOLVE_RETRY_MS + SECOND_WRAPPER_RETRY_MS
        )
        await flushAsyncTicks()

        // Assert the floor (initial read + two retries), not an exact count: an incidental droid reconfirm can add one more.
        expect(
          vi.mocked(window.api.pty.confirmForegroundProcess).mock.calls.length
        ).toBeGreaterThanOrEqual(3)
        expect(mockStoreState.paneForegroundAgentByPaneKey[cacheKey]).toEqual({
          agent: null,
          shellForeground: true
        })
        expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, cacheKey)).toBe('alt-enter')
      })

      it('does not let persisted args spoof pane identity without an allowlisted command', async () => {
        vi.useFakeTimers()
        const ptyId = 'pty-unknown-persisted-launch'
        const tabId = `tab-${ptyId}`
        mockStoreState.tabsByWorktree = { 'wt-1': [{ id: tabId, ptyId }] }
        mockStoreState.registerAgentLaunchConfig.mockImplementation(
          (key: string, launchConfig: unknown, identity: { agentType?: string }): void => {
            mockStoreState.agentLaunchConfigByPaneKey[key] = { launchConfig, identity }
          }
        )

        const { cacheKey } = await connectRestoredPaneForForegroundSampling({
          ptyId,
          tabId,
          isVisibleRef: { current: false },
          launchConfig: {
            agentCommand: 'custom-wrapper --agent droid',
            agentArgs: 'droid',
            agentEnv: {}
          }
        })
        await vi.advanceTimersByTimeAsync(300)
        await flushAsyncTicks(20)

        expect(
          mockStoreState.agentLaunchConfigByPaneKey[cacheKey]?.identity?.agentType
        ).toBeUndefined()
        expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, cacheKey)).toBe('alt-enter')
      })

      it('does not re-scan stale launch metadata after the local ladder confirms shell', async () => {
        vi.useFakeTimers()
        const getForegroundProcess = vi.mocked(window.api.pty.getForegroundProcess)
        getForegroundProcess.mockResolvedValue('powershell.exe')
        const isVisibleRef = { current: false }
        const ptyId = 'pty-stale-launch-shell-settled'
        const tabId = `tab-${ptyId}`
        mockStoreState.tabsByWorktree = {
          'wt-1': [{ id: tabId, ptyId, launchAgent: 'droid' }]
        }
        mockStoreState.registerAgentLaunchConfig.mockImplementation(
          (key: string, launchConfig: unknown, identity: { agentType?: string }): void => {
            mockStoreState.agentLaunchConfigByPaneKey[key] = { launchConfig, identity }
          }
        )
        mockStoreState.clearAgentLaunchConfig.mockImplementation((key: string) => {
          delete mockStoreState.agentLaunchConfigByPaneKey[key]
        })

        const { binding, cacheKey } = await connectRestoredPaneForForegroundSampling({
          ptyId,
          tabId,
          isVisibleRef,
          launchConfig: { agentCommand: 'droid', agentArgs: '', agentEnv: {} }
        })
        await vi.advanceTimersByTimeAsync(300)
        await flushAsyncTicks(20)
        // Launch metadata starts confirmation but is never byte-routing authority.
        expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, cacheKey)).toBe('alt-enter')
        isVisibleRef.current = true
        binding.noteVisibilityResume()
        await advanceVisibleForegroundRead()
        await vi.advanceTimersByTimeAsync(WRAPPER_RESOLVE_RETRY_MS)
        await vi.advanceTimersByTimeAsync(SECOND_WRAPPER_RETRY_MS)

        expect(foregroundReadCallsFor(ptyId).length).toBeGreaterThanOrEqual(3)
        expect(mockStoreState.paneForegroundAgentByPaneKey[cacheKey]).toEqual({
          agent: null,
          shellForeground: true
        })
        expect(mockStoreState.clearAgentLaunchConfig).toHaveBeenCalledWith(cacheKey)

        mockStoreState.paneForegroundAgentByPaneKey[cacheKey] = {
          agent: null,
          shellForeground: false
        }
        expect(resolveMockPaneWindowsShiftEnterEncoding(mockStoreState, cacheKey)).toBe('alt-enter')

        vi.clearAllTimers()
        const settledReadCount = foregroundReadCallsFor(ptyId).length
        binding.sampleForegroundAgentOnFocus()
        await vi.advanceTimersByTimeAsync(
          VISIBLE_PTY_SETTLE_MS + WRAPPER_RESOLVE_RETRY_MS + SECOND_WRAPPER_RETRY_MS
        )
        expect(foregroundReadCallsFor(ptyId)).toHaveLength(settledReadCount)
      })

      it('does not re-sample a shell-confirmed pane from stale launch metadata', async () => {
        vi.useFakeTimers()
        const getForegroundProcess = vi.mocked(window.api.pty.getForegroundProcess)
        getForegroundProcess.mockResolvedValue('codex')
        const ptyId = 'pty-shell-foreground-launch-agent-sample'
        const tabId = `tab-${ptyId}`
        mockStoreState.tabsByWorktree = {
          'wt-1': [{ id: tabId, ptyId, launchAgent: 'codex' }]
        }
        mockStoreState.paneForegroundAgentByPaneKey[makePaneKey(tabId, LEAF_1)] = {
          agent: null,
          shellForeground: true
        }

        const { cacheKey } = await connectRestoredPaneForForegroundSampling({ ptyId, tabId })
        await advanceVisibleForegroundRead()

        expect(foregroundReadCallsFor(ptyId)).toHaveLength(0)
        expect(mockStoreState.setPaneForegroundAgent).not.toHaveBeenCalledWith(
          cacheKey,
          expect.anything()
        )
      })

      it('fails closed when a leaked 133;D cancels identityless recovery', async () => {
        // Why: a cached visible read has no routing authority; on a racing command boundary, trust the shell marker over stale identity.
        vi.useFakeTimers()
        const { connectPanePty } = await import('../connect-pane-pty')
        const agentTitleMocks3 = await vi.importMock<PtyConnectionAgentTitleMocks>(
          '@/lib/agent-status/aggregation/worktree-agent-status'
        )
        const getForegroundProcess = vi.mocked(window.api.pty.getForegroundProcess)
        getForegroundProcess.mockResolvedValue('codex')
        const ptyId = 'pty-reattach-idle-codex-leaked-d'
        const tabId = `tab-${ptyId}`
        const dataCallbackRef: { current: ((data: string) => void) | null } = { current: null }
        const transport = createMockTransport(ptyId)
        transport.connect.mockImplementation(
          async ({
            sessionId,
            callbacks
          }: {
            sessionId?: string
            callbacks?: ConnectCallbacks
          }) => {
            dataCallbackRef.current = callbacks?.onData ?? null
            return sessionId ? { id: sessionId } : null
          }
        )
        transportFactoryQueue.push(transport)
        const deps = createDeps({
          tabId,
          restoredLeafId: LEAF_1,
          restoredPtyIdByLeafId: { [LEAF_1]: ptyId }
        })
        connectPanePty(
          createPane(1) as never,
          createManager(1) as never,
          bindPaneAgentTitleMocks(deps as never, agentTitleMocks3)
        )
        await vi.advanceTimersByTimeAsync(20)
        await flushAsyncTicks(20)

        const cacheKey = makePaneKey(tabId, LEAF_1)
        dataCallbackRef.current?.('\x1b]133;D;0\x07')

        await advanceVisibleForegroundRead()

        expect(mockStoreState.setPaneForegroundAgent).toHaveBeenCalledWith(cacheKey, {
          agent: null,
          shellForeground: true
        })
        expect(foregroundReadCallsFor(ptyId)).toHaveLength(0)
      })

    })
  })
}
