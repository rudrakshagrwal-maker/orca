import { describe, expect, it, vi } from 'vitest'
import { createAgentCompletionCoordinator } from './agent-completion-coordinator'
import {
  HOOK_DONE_QUIET_MS,
  useAgentCompletionCoordinatorLifecycle
} from './agent-completion-coordinator-test-harness'

describe('agent completion coordinator', () => {
  useAgentCompletionCoordinatorLifecycle()

  it('cancels a pending done timer when a waiting state arrives before the quiet window', () => {
    const dispatchCompletion = vi.fn()
    const dispatchAttention = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      inspectProcess: vi.fn(),
      dispatchCompletion,
      dispatchAttention,
      isLive: () => true
    })

    const turn = {
      prompt: 'fix the bug',
      agentType: 'cursor' as const
    }

    coordinator.observeHookStatus({ state: 'working', ...turn })
    coordinator.observeHookStatus({ state: 'done', ...turn, lastAssistantMessage: 'Done.' })
    expect(coordinator.hasPendingHookDoneCompletion()).toBe(true)

    // Attention arriving within the quiet window must cancel provisional completion.
    coordinator.observeHookStatus({
      state: 'waiting',
      ...turn,
      toolName: 'Shell',
      toolInput: 'pnpm test'
    })
    expect(coordinator.hasPendingHookDoneCompletion()).toBe(false)
    vi.advanceTimersByTime(HOOK_DONE_QUIET_MS)

    expect(dispatchCompletion).not.toHaveBeenCalled()
    expect(dispatchAttention).toHaveBeenCalledWith(
      'cursor',
      expect.objectContaining({
        source: 'hook',
        agentStatus: expect.objectContaining({
          state: 'waiting',
          agentType: 'cursor',
          toolInput: 'pnpm test'
        })
      })
    )
  })

})
