import { isTerminalWritePipelineCertifiedDead } from './terminal-write-pipeline-health'
import {
  coalescedQueuedDataNeedsCursorRestore,
  containsDrainableCursorRestore
} from './pane-terminal-cursor-sequencing'
import { enqueueChunk } from './pane-terminal-output-queue-chunks'
// RA: reuse the credited parser pipeline for immediate interactive echo.
import { writeQueuedChunk } from './pane-terminal-output-pipeline'
import {
  exposeTerminalOutputSchedulerDebugApi,
  terminalOutputSchedulerDebugEnabled,
  terminalOutputSchedulerDebugState
} from './pane-terminal-output-scheduler-debug'
import { queueCapExceeded, replaceBacklogWithWarning } from './pane-terminal-output-queue-backlog'
import {
  FOREGROUND_HOLD_SAFETY_DELAY_MS,
  LATENCY_SENSITIVE_FOREGROUND_COALESCE_DELAY_MS,
  LATENCY_SENSITIVE_FOREGROUND_HOLD_SAFETY_DELAY_MS,
  clearForegroundCoalesce,
  clearForegroundHoldSafety,
  clearForegroundRelease,
  createQueueEntry,
  inheritRecentForegroundSafetyFlush,
  scheduleForegroundCoalesceRelease,
  scheduleForegroundHoldSafety
} from './pane-terminal-foreground-queue-state'
import {
  BACKGROUND_FLUSH_DELAY_MS,
  FOREGROUND_BACKLOG_WARNING,
  LARGE_BACKLOG_CHARS,
  queuedByTerminal,
  parsingTerminals,
  isTerminalOutputSuspended,
  scheduleDrain,
  type WriteTerminalOutputOptions
} from './pane-terminal-output-queue-registry'
import type { ForegroundTerminalOutputTarget } from './pane-terminal-foreground-render-settle'

export function writeTerminalOutputImpl(
  terminal: ForegroundTerminalOutputTarget,
  data: string,
  options: WriteTerminalOutputOptions
): void {
  // RA: credit transport immediately while retaining bounded bytes without parsing xterm.
  const suspended = isTerminalOutputSuspended(terminal)
  if (suspended) {
    options.ackCredit?.()
    options = { ...options, foreground: false, ackCredit: undefined }
  }
  exposeTerminalOutputSchedulerDebugApi()
  // Why: recovery may be budget-delayed while PTY output keeps flowing; main owns the authoritative buffer, so credit delivery without waking dead xterm.
  if (isTerminalWritePipelineCertifiedDead(terminal)) {
    options.ackCredit?.()
    return
  }
  if (!data) {
    // Why: an empty write still consumed its delivery — credit or main's in-flight window leaks.
    options.ackCredit?.()
    return
  }

  if (options.foreground) {
    const entry = queuedByTerminal.get(terminal)
    // RA: only a small unheld echo with no queued/in-flight predecessor bypasses paint.
    const immediate =
      options.latencySensitive === true &&
      data.length <= 1024 &&
      entry === undefined &&
      !parsingTerminals.has(terminal) &&
      !options.holdForeground &&
      !options.coalesceForeground
    const queued = entry ?? createQueueEntry(terminal, options)
    if (entry === undefined && options.coalesceForeground) {
      inheritRecentForegroundSafetyFlush(queued)
    }
    queued.onBackgroundBacklogDropped = options.onBackgroundBacklogDropped
    // Sticky: writers that don't track the stream position (notices, idle resets) leave it in place.
    queued.onBacklogReplaced = options.onBacklogReplaced ?? queued.onBacklogReplaced
    queued.highPriority = true
    // RA: keep protocol urgency until this FIFO has drained.
    queued.protocolQuery ||= options.protocolQuery
    queuedByTerminal.set(terminal, queued)
    enqueueChunk(queued, data, {
      foreground: true,
      forceForegroundRefresh: options.forceForegroundRefresh,
      followupForegroundRefresh: options.followupForegroundRefresh,
      shouldRefreshForegroundSynchronously: options.shouldRefreshForegroundSynchronously,
      stripTransientCursorShows: options.stripTransientCursorShows,
      beforeWrite: options.beforeWrite,
      onParsed: options.onParsed,
      ackCredit: options.ackCredit
    })
    if (immediate) {
      queuedByTerminal.delete(terminal)
      writeQueuedChunk(queued, 1024)
      return
    }
    if (terminalOutputSchedulerDebugEnabled) {
      terminalOutputSchedulerDebugState.foregroundWriteCount++
      terminalOutputSchedulerDebugState.deferredForegroundEnqueueCount++
    }
    // Why: a visible pane's queue was previously uncapped — a flood the drain couldn't keep up with ballooned renderer memory without bound.
    // RA: credited streams backpressure upstream; only uncredited synthetic output may drop.
    if (!queued.hasDeliveryCredit && queueCapExceeded(queued)) {
      replaceBacklogWithWarning(queued, FOREGROUND_BACKLOG_WARNING)
      scheduleDrain(0)
      return
    }
    if (options.holdForeground) {
      // Why: synchronized-output start/body chunks contain transient cursor moves; holding them prevents Chromium from rasterizing those states.
      if (options.latencySensitive === true) {
        // Why: Codex composer redraws can split the end marker from the input-triggered frame; keep cursor protection without a human-visible fallback delay on typed chars.
        queued.foregroundHoldSafetyDelayMs = Math.min(
          queued.foregroundHoldSafetyDelayMs,
          LATENCY_SENSITIVE_FOREGROUND_HOLD_SAFETY_DELAY_MS
        )
      } else if (!queued.foregroundHold) {
        queued.foregroundHoldSafetyDelayMs = FOREGROUND_HOLD_SAFETY_DELAY_MS
      }
      queued.foregroundHold = true
      clearForegroundCoalesce(queued)
      scheduleForegroundHoldSafety(queued)
      return
    }
    if (options.coalesceForeground || queued.foregroundCoalesce) {
      queued.foregroundHold = false
      clearForegroundHoldSafety(queued)
      const shouldShortenCoalesceForLatencySensitiveForeground = options.latencySensitive === true
      if (shouldShortenCoalesceForLatencySensitiveForeground) {
        // Why: user input echo must not inherit the normal synchronized-frame restore fallback; wait briefly for the restore, then paint.
        queued.foregroundCoalesceDelayMs = Math.min(
          queued.foregroundCoalesceDelayMs,
          LATENCY_SENSITIVE_FOREGROUND_COALESCE_DELAY_MS
        )
      }
      const shouldDrainForLatencySensitiveForeground =
        shouldShortenCoalesceForLatencySensitiveForeground &&
        !coalescedQueuedDataNeedsCursorRestore(queued)
      if (containsDrainableCursorRestore(data) || shouldDrainForLatencySensitiveForeground) {
        clearForegroundRelease(queued)
        scheduleDrain(0)
        return
      }
      // Why: the PTY transport can split TUI synchronized-output end markers from the cursor-restoring bytes; wait for the restore, with the timer as bounded fallback.
      scheduleForegroundCoalesceRelease(queued, {
        rescheduleEarlier: shouldShortenCoalesceForLatencySensitiveForeground
      })
      return
    }
    queued.foregroundHold = false
    clearForegroundRelease(queued)
    scheduleDrain(0)
    return
  }

  let entry = queuedByTerminal.get(terminal)
  if (!entry) {
    entry = createQueueEntry(terminal, options)
    entry.highPriority = false
    queuedByTerminal.set(terminal, entry)
  } else {
    entry.onBackgroundBacklogDropped = options.onBackgroundBacklogDropped
    // Sticky: writers that don't track the stream position (notices, idle resets) leave it in place.
    entry.onBacklogReplaced = options.onBacklogReplaced ?? entry.onBacklogReplaced
  }
  enqueueChunk(entry, data, {
    beforeWrite: options.beforeWrite,
    onParsed: options.onParsed,
    ackCredit: options.ackCredit
  })
  // RA: hidden protocol-only writes use the same timer path as foreground queries.
  entry.protocolQuery ||= options.protocolQuery
  if (queueCapExceeded(entry)) {
    replaceBacklogWithWarning(entry)
  }
  if (terminalOutputSchedulerDebugEnabled) {
    terminalOutputSchedulerDebugState.backgroundEnqueueCount++
  }
  if (suspended) {
    return
  }
  // Why: letting every non-focused pane call xterm.write immediately spawns a WriteBuffer timer per pane, starving the focused terminal on the shared renderer thread.
  scheduleDrain(
    entry.highPriority || entry.queuedChars > LARGE_BACKLOG_CHARS ? 0 : BACKGROUND_FLUSH_DELAY_MS
  )
}
