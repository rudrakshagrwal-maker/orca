import { describe, expect, it, vi } from 'vitest'
import { createAgentCompletionCoordinator } from './agent-completion-coordinator'
import {
  flushAsyncTicks,
  HOOK_DONE_QUIET_MS,
  processResult,
  useAgentCompletionCoordinatorLifecycle
} from './agent-completion-coordinator-test-harness'

describe('agent completion coordinator', () => {
  useAgentCompletionCoordinatorLifecycle()

  it('cancels a hook completion when the same turn resumes work before the quiet window', () => {
    const dispatchCompletion = vi.fn()
    const coordinator = createAgentCompletionCoordinator({
      paneKey: 'tab-1:leaf-1',
      getPtyId: () => 'pty-1',
      inspectProcess: vi.fn(),
      dispatchCompletion,
      isLive: () => true
    })

    coordinator.observeHookStatus({
      state: 'working',
      prompt: 'run the goal',
      agentType: 'codex'
    })
    coordinator.observeHookStatus({
      state: 'done',
      prompt: 'run the goal',
      agentType: 'codex'
    })
    expect(coordinator.hasPendingHookDoneCompletion()).toBe(true)
    vi.advanceTimersByTime(HOOK_DONE_QUIET_MS - 1)
    expect(dispatchCompletion).not.toHaveBeenCalled()

    coordinator.observeHookStatus({
      state: 'working',
      prompt: 'run the goal',
      agentType: 'codex'
    })
    expect(coordinator.hasPendingHookDoneCompletion()).toBe(false)
    vi.advanceTimersByTime(HOOK_DONE_QUIET_MS)
    expect(dispatchCompletion).not.toHaveBeenCalled()

    coordinator.observeHookStatus({
      state: 'done',
      prompt: 'run the goal',
      agentType: 'codex'
    })
    vi.advanceTimersByTime(HOOK_DONE_QUIET_MS)

    expect(dispatchCompletion).toHaveBeenCalledTimes(1)
    expect(dispatchCompletion).toHaveBeenCalledWith(
      'codex',
      expect.objectContaining({
        source: 'hook',
        quietedHookDone: true,
        agentStatus: expect.objectContaining({
          state: 'done',
          prompt: 'run the goal',
          agentType: 'codex'
        })
      })
    )
  })

})
