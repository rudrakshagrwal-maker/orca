import { describe, expect, it, vi } from 'vitest'
import { startupCwdErrorActions } from './terminal-error-display'

// RA: a missing-folder toast offers only the actions the pane armed, so no button is dead.
const MISSING = 'startup_cwd_missing: saved folder C:/gone is unavailable'

describe('startupCwdErrorActions', () => {
  it('offers nothing for other errors, and nothing without an armed transport', () => {
    const retry = vi.fn(() => true)
    expect(startupCwdErrorActions('boom', { retryRecovery: retry })).toEqual({})
    expect(startupCwdErrorActions(MISSING, undefined)).toEqual({})
    expect(startupCwdErrorActions(MISSING, {})).toEqual({})
  })

  it('offers Retry and Start in workspace root, each calling its transport action', async () => {
    const retry = vi.fn(() => true)
    const root = vi.fn(() => false)
    const actions = startupCwdErrorActions(MISSING, {
      retryRecovery: retry,
      startInWorkspaceRoot: root
    })
    await expect(actions.onRetry?.()).resolves.toBe(true)
    await expect(actions.onStartInWorkspaceRoot?.()).resolves.toBe(false)
    expect(retry).toHaveBeenCalledOnce()
    expect(root).toHaveBeenCalledOnce()
    expect(startupCwdErrorActions(MISSING, { retryRecovery: retry }).onStartInWorkspaceRoot).toBe(
      undefined
    )
  })
})
