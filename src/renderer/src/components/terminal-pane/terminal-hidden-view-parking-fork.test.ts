import { describe, expect, it } from 'vitest'
import {
  selectIdsBeyondHotRetain,
  TERMINAL_TAB_COLD_PARK_DELAY_MS,
  TERMINAL_TAB_HOT_RETAIN_LIMIT,
  TERMINAL_WORKTREE_COLD_PARK_DELAY_MS,
  TERMINAL_WORKTREE_HOT_RETAIN_LIMIT
} from './parking/retention/terminal-hidden-view-parking'

// RA: this suite uses the shipped fork policy rather than the optional upstream retention policy.
describe('fork hidden terminal budget', () => {
  it('parks even the most recently hidden view once eligible', () => {
    expect(TERMINAL_TAB_COLD_PARK_DELAY_MS).toBe(5_000)
    expect(TERMINAL_WORKTREE_COLD_PARK_DELAY_MS).toBe(5_000)
    expect(TERMINAL_TAB_HOT_RETAIN_LIMIT).toBe(0)
    expect(TERMINAL_WORKTREE_HOT_RETAIN_LIMIT).toBe(0)
    expect(
      selectIdsBeyondHotRetain(
        [{ id: 'last-active', hiddenSinceMs: 0 }],
        { nowMs: 5_000, hotRetainMs: 300_000, hotRetainLimit: 0 }
      )
    ).toEqual(new Set(['last-active']))
  })
})
