import {
  recordTerminalOutputQueueDebugPressure,
  terminalOutputSchedulerDebugEnabled,
  terminalOutputSchedulerDebugState
} from './pane-terminal-output-scheduler-debug'
import { clearForegroundRelease, isEntryDrainable } from './pane-terminal-foreground-queue-state'
import { hasHighPriorityBacklog, hasQueuedChunks } from './pane-terminal-output-queue-backlog'
import {
  BACKGROUND_DRAIN_INTERVAL_MS,
  markTerminalOutputDrainStarted,
  queuedByTerminal,
  parsingTerminals,
  parseMsPerChar,
  scheduleDrain,
  setTerminalOutputDrainRunner
} from './pane-terminal-output-queue-registry'

// RA: plan all panes together, then enforce the wall-clock deadline between submissions.
import {
  planTerminalOutputFrame,
  TERMINAL_FRAME_MS,
  TERMINAL_MIN_MS_PER_CHAR
} from './terminal-output-frame-budget'
import { writeQueuedChunk } from './pane-terminal-output-pipeline'

function hasDrainableBacklog(): boolean {
  for (const entry of queuedByTerminal.values()) {
    if (isEntryDrainable(entry) && !parsingTerminals.has(entry.terminal)) {
      return true
    }
  }
  return false
}

// Why no per-write scroll enforcement: xterm's BufferService.isUserScrolling owns live follow/pin; app-side enforcement is limited to structural ops xterm can't identify, like replay.

function getDrainNow(): number {
  if (typeof performance !== 'undefined') {
    return performance.now()
  }
  return Date.now()
}

export function drainQueuedOutputImpl(): void {
  markTerminalOutputDrainStarted()
  let writes = 0
  const startedAt = getDrainNow()
  const highPriority = hasHighPriorityBacklog()
  const candidates = Array.from(queuedByTerminal.values())
    .filter((entry) => isEntryDrainable(entry) && !parsingTerminals.has(entry.terminal))
    .sort((a, b) => Number(b.highPriority) - Number(a.highPriority))
    .map((pane) => ({
      pane,
      queuedChars: pane.queuedChars,
      msPerChar: parseMsPerChar.get(pane.terminal) ?? TERMINAL_MIN_MS_PER_CHAR
    }))
  const frame = planTerminalOutputFrame(candidates, getDrainNow() - startedAt)

  for (const { pane: entry, maxChars } of frame) {
    if (getDrainNow() - startedAt >= TERMINAL_FRAME_MS) {
      break
    }
    queuedByTerminal.delete(entry.terminal)
    const writeKind = writeQueuedChunk(entry, maxChars)
    if (writeKind) {
      writes++
      if (terminalOutputSchedulerDebugEnabled) {
        if (writeKind === 'foreground') {
          terminalOutputSchedulerDebugState.deferredForegroundWriteCount++
        } else {
          terminalOutputSchedulerDebugState.backgroundWriteCount++
        }
      }
    }
    if (hasQueuedChunks(entry)) {
      queuedByTerminal.set(entry.terminal, entry)
    } else {
      entry.highPriority = false
      clearForegroundRelease(entry)
    }
    // Yield cooperatively: xterm parsing and input share the renderer thread, so output floods must not pin it.
    if (writes > 0 && getDrainNow() - startedAt >= TERMINAL_FRAME_MS) {
      break
    }
  }

  if (terminalOutputSchedulerDebugEnabled && writes > 0) {
    terminalOutputSchedulerDebugState.drainWrites.push(writes)
    terminalOutputSchedulerDebugState.drainHighPriority.push(highPriority)
  }
  recordTerminalOutputQueueDebugPressure()
  if (queuedByTerminal.size > 0 && hasDrainableBacklog()) {
    // RA: round-robin carry-over waits for paint; parser callbacks can only arm that same frame.
    scheduleDrain(hasHighPriorityBacklog() ? 0 : BACKGROUND_DRAIN_INTERVAL_MS)
  }
}

// Register at module evaluation so scheduleDrain cannot run before its downstream runner exists.
setTerminalOutputDrainRunner(drainQueuedOutputImpl)
