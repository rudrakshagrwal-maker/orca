/** Quiet foreground is insufficient until the agent paints; use command-start markers to exclude shell prompts and launch echo. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTranscriptPane,
  TRANSCRIPT_PANE_PTY_ID
} from '../../orca-runtime-tests/agent-transcript-pane-test-harness'

const POLL_INTERVAL_MS = 2_000

describe('tui-idle on an agent with no rest signal', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not finish a command-start marker cut off by dropped output', async () => {
    const { runtime, handle } = await createTranscriptPane({
      paneTitle: 'Terminal',
      foregroundProcess: 'amp',
      launchAgent: 'amp',
      data: ''
    })
    vi.useFakeTimers()
    const write = (chunk: string) => runtime.onPtyData(TRANSCRIPT_PANE_PTY_ID, chunk, Date.now())
    // Fish's marker carries the command line, so a cut-off one can terminate on unrelated output.
    write('~/repo % amp\r\n\x1b]133;C;cmdline_url=am')
    runtime.notePtyDataGap(TRANSCRIPT_PANE_PTY_ID, 4096)
    write('╭─ Amp ─╮\r\n│ > │\x1b]0;amp\x07')
    const wait = runtime.waitForTerminal(handle, { condition: 'tui-idle', timeoutMs: 60_000 })

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
    await expect(wait).resolves.toMatchObject({ satisfied: true })
  })
})
