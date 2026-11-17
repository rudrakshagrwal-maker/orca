import {
  discardForegroundRenderSettle,
  type ForegroundTerminalOutputTarget
} from './pane-terminal-foreground-render-settle'
import { discardInFlightTerminalOutputAckCredits } from './pane-terminal-output-ack-credit'
import { cancelTerminalWriteStallWatch } from './terminal-write-pipeline-health'
import {
  TERMINAL_OUTPUT_BACKLOG_MIN_CAP_CHARS,
  terminalOutputBacklogCapChars
} from '../../../../../shared/terminal/replay/terminal-scrollback-policy'
import {
  exposeTerminalOutputSchedulerDebugApi,
  recordTerminalOutputQueueDebugPressure,
  setTerminalOutputDebugQueueReader,
  terminalOutputSchedulerDebugEnabled,
  terminalOutputSchedulerDebugState
} from './pane-terminal-output-scheduler-debug'

// RA: bounded output stays queued while hidden, including explicit flush requests.
const suspendedTerminals = new WeakSet<object>()
export function isTerminalOutputSuspended(terminal: object): boolean {
  return suspendedTerminals.has(terminal)
}
export function setTerminalOutputSuspended(
  terminal: ForegroundTerminalOutputTarget,
  suspended: boolean
): void {
  if (suspended) {
    suspendedTerminals.add(terminal)
    discardForegroundRenderSettle(terminal)
    cancelTerminalWriteStallWatch(terminal)
    const entry = queuedByTerminal.get(terminal)
    if (entry) {
      fireQueuedAckCredits(entry)
      for (let index = entry.chunkIndex; index < entry.chunks.length; index++) {
        entry.chunks[index].ackCredit = undefined
      }
      clearTimeout(entry.foregroundHoldSafetyTimer ?? undefined)
      clearTimeout(entry.foregroundCoalesceTimer ?? undefined)
      entry.foregroundHoldSafetyTimer = null
      entry.foregroundCoalesceTimer = null
      entry.foregroundHold = false
      entry.foregroundCoalesce = false
    }
  } else {
    suspendedTerminals.delete(terminal)
    scheduleDrain(0)
  }
}

export type TerminalOutputBeforeWrite = (data: string) => void
type TerminalBacklogRecoveryRequest = () => boolean
export type TerminalOutputParsedCallback = () => void
type ForegroundRefreshSyncResolver = () => boolean

export type WriteTerminalOutputOptions = {
  foreground: boolean
  beforeWrite?: TerminalOutputBeforeWrite
  onParsed?: TerminalOutputParsedCallback
  /** Fire delivery ACK once on parse OR discard; duplicate calls are safe, omission permanently shrinks main’s in-flight window. */
  ackCredit?: () => void
  onBackgroundBacklogDropped?: () => void
  /** Every backlog replacement: queued bytes vanished behind the warning, leaving a gap in the pane's stream. */
  onBacklogReplaced?: () => void
  latencySensitive?: boolean
  // RA: protocol negotiation must progress even when Chromium suspends painting.
  protocolQuery?: boolean
  forceForegroundRefresh?: boolean
  followupForegroundRefresh?: boolean
  shouldRefreshForegroundSynchronously?: ForegroundRefreshSyncResolver
  stripTransientCursorShows?: boolean
  coalesceForeground?: boolean
  holdForeground?: boolean
}

type QueueChunk = {
  data: string
  // Tracks the backing data still reachable through this queue slot.
  retainedChars: number
  foreground: boolean
  forceForegroundRefresh: boolean
  followupForegroundRefresh: boolean
  shouldRefreshForegroundSynchronously: ForegroundRefreshSyncResolver
  stripTransientCursorShows: boolean
  beforeWrite?: TerminalOutputBeforeWrite
  onParsed?: TerminalOutputParsedCallback
  ackCredit?: () => void
}

export type QueuedWrite = {
  data: string
  foreground: boolean
  forceForegroundRefresh: boolean
  followupForegroundRefresh: boolean
  shouldRefreshForegroundSynchronously: ForegroundRefreshSyncResolver
  stripTransientCursorShows: boolean
  beforeWrite?: TerminalOutputBeforeWrite
  onParsed?: TerminalOutputParsedCallback
  ackCredits: (() => void)[]
}

export type QueueEntry = {
  // RA: preserve FIFO while giving protocol-bearing queues a timer-owned drain.
  protocolQuery?: boolean
  // RA: credited streams are bounded upstream and must never be replaced by a synthetic notice.
  hasDeliveryCredit?: boolean
  terminal: ForegroundTerminalOutputTarget
  chunks: QueueChunk[]
  chunkIndex: number
  queuedChars: number
  onBackgroundBacklogDropped?: () => void
  onBacklogReplaced?: () => void
  backgroundBacklogDropped: boolean
  highPriority: boolean
  foregroundHold: boolean
  foregroundHoldSafetyDelayMs: number
  foregroundCoalesce: boolean
  foregroundCoalesceDelayMs: number
  foregroundHoldSafetyTimer: ReturnType<typeof setTimeout> | null
  foregroundCoalesceTimer: ReturnType<typeof setTimeout> | null
  // Why: hold and coalesce cancel each other's fallback timer, so an alternating DEC 2026 stream could re-arm both forever and freeze a visible pane (#8754). This caps one non-drainable episode.
  foregroundReleaseDeadlineAt: number | null
  // Why: an open frame's own hold chunks may still push the deadline out, but once coalesce has taken the entry over the deadline stops moving so the two mechanisms can't re-arm each other.
  foregroundReleaseDeadlineFixed: boolean
  // Why: continuous tool output may re-arm hold chunks indefinitely; allow one split-frame extension, then force the safety flush.
  foregroundHoldSafetyExtended: boolean
}

export const BACKGROUND_FLUSH_DELAY_MS = 50
export const BACKGROUND_DRAIN_INTERVAL_MS = 16
export const HIGH_PRIORITY_DRAIN_INTERVAL_MS = 4
export const BACKGROUND_CHUNK_CHARS = 16 * 1024
export const MAX_WRITES_PER_DRAIN = 2
// Eight × 16KB gives ~1.3ms parse/tick (~30MB/s) within the time budget; two writes limited the ~100MB/s parser to ~8MB/s.
export const HIGH_PRIORITY_MAX_WRITES_PER_DRAIN = 8
export const DRAIN_TIME_BUDGET_MS = 8
export const LARGE_BACKLOG_CHARS = 512 * 1024
// Why mutable: the cap scales with the user's scrollback setting (terminalOutputBacklogCapChars), configured when settings apply; the chunk-count cap stays fixed.
let maxQueueChars = TERMINAL_OUTPUT_BACKLOG_MIN_CAP_CHARS
export const MAX_BACKGROUND_QUEUE_CHUNKS = 4096

export function configureTerminalOutputBacklogCap(scrollbackRows: unknown): void {
  maxQueueChars = terminalOutputBacklogCapChars(scrollbackRows)
}

export function getTerminalOutputMaxQueueChars(): number {
  return maxQueueChars
}
// CAN aborts partial escapes before style reset; also close DEC 2026 because discarded tails may contain its end marker, hiding even the warning until xterm’s 1000ms timeout.
export const BACKGROUND_BACKLOG_WARNING =
  '\x18\x1b[?2026l\x1b[0m\r\n[Orca skipped hidden terminal output because the backlog grew too large.]\r\n'
// Why a separate foreground message: a visible pane hitting the cap means the drain couldn't keep up with a flood (starved renderer), not merely output produced while hidden.
export const FOREGROUND_BACKLOG_WARNING =
  '\x18\x1b[?2026l\x1b[0m\r\n[Orca skipped a burst of terminal output because the backlog grew too large.]\r\n'
export const ALWAYS_REFRESH_FOREGROUND_SYNCHRONOUSLY = (): boolean => true

export const queuedByTerminal = new Map<ForegroundTerminalOutputTarget, QueueEntry>()
setTerminalOutputDebugQueueReader(() => queuedByTerminal.values())
const backlogRecoveryByTerminal = new WeakMap<
  ForegroundTerminalOutputTarget,
  TerminalBacklogRecoveryRequest
>()
let drainTimer: ReturnType<typeof setTimeout> | null = null
let drainTimerDelayMs: number | null = null
// RA: one shared animation frame prevents parse callbacks from draining between paints.
let drainFrame: number | null = null
export const parsingTerminals = new WeakSet<ForegroundTerminalOutputTarget>()
export const parseMsPerChar = new WeakMap<ForegroundTerminalOutputTarget, number>()
// Why indirect: the drain loop lives downstream of this module, so it registers itself here rather than being imported back into the queue state it operates on.
let runDrain: (() => void) | null = null

export function setTerminalOutputDrainRunner(runner: () => void): void {
  runDrain = runner
  // RA: replace a suspended frame when minimizing, restoring, or refocusing the window.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', rearmDrain)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', rearmDrain)
  }
}

function cancelDrainFrame(): void {
  if (drainFrame !== null) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(drainFrame)
    }
    drainFrame = null
  }
}

function rearmDrain(): void {
  cancelDrainFrame()
  if (drainTimer !== null) {
    clearTimeout(drainTimer)
  }
  drainTimer = null
  drainTimerDelayMs = null
  scheduleDrain(0)
}

function runDrainTick(): void {
  runDrain?.()
}

export function markTerminalOutputDrainStarted(): void {
  drainTimer = null
  drainTimerDelayMs = null
  drainFrame = null
}

export function scheduleDrain(delayMs: number): void {
  // RA: protocol replies and minimized windows cannot depend on an animation frame.
  const timerRequired =
    (typeof document !== 'undefined' && document.visibilityState === 'hidden') ||
    Array.from(queuedByTerminal.values()).some((entry) => entry.protocolQuery)
  if (drainFrame !== null && !timerRequired) {
    return
  }
  if (timerRequired) {
    cancelDrainFrame()
  }
  // RA: promoting a timer-owned background queue must still wait for a visible frame.
  const hasVisibleOutput = Array.from(queuedByTerminal.values()).some((entry) => entry.highPriority)
  const useFrame = !timerRequired && hasVisibleOutput && typeof requestAnimationFrame === 'function'
  if (drainTimer !== null) {
    if (!useFrame && drainTimerDelayMs !== null && drainTimerDelayMs <= delayMs) {
      return
    }
    clearTimeout(drainTimer)
    drainTimer = null
    drainTimerDelayMs = null
  }
  if (queuedByTerminal.size === 0) {
    return
  }
  if (terminalOutputSchedulerDebugEnabled) {
    terminalOutputSchedulerDebugState.scheduledDrainCount++
  }
  // RA: visible splits share one frame; timers remain for background-only output.
  if (useFrame) {
    const frame = requestAnimationFrame(() => {
      // RA: ignore an obsolete callback if cancellation raced a visibility transition.
      if (drainFrame === frame) {
        runDrainTick()
      }
    })
    drainFrame = frame
    return
  }
  // RA: non-browser consumers retain the same bounded visible cadence.
  drainTimer = setTimeout(
    runDrainTick,
    hasVisibleOutput && !timerRequired ? Math.max(16, delayMs) : delayMs
  )
  drainTimerDelayMs = delayMs
}

// Every discard must credit before clearing/replacing; consumed deliveries otherwise permanently shrink main’s window and wedge the PTY.
export function fireQueuedAckCredits(entry: QueueEntry): void {
  for (let index = entry.chunkIndex; index < entry.chunks.length; index += 1) {
    entry.chunks[index].ackCredit?.()
  }
}

export function requestRegisteredTerminalBacklogRecovery(
  terminal: ForegroundTerminalOutputTarget
): boolean {
  const requestRecovery = backlogRecoveryByTerminal.get(terminal)
  if (!requestRecovery) {
    return false
  }
  return requestRecovery()
}

export function registerTerminalBacklogRecovery(
  terminal: ForegroundTerminalOutputTarget,
  requestRecovery: TerminalBacklogRecoveryRequest
): () => void {
  backlogRecoveryByTerminal.set(terminal, requestRecovery)
  return () => {
    if (backlogRecoveryByTerminal.get(terminal) === requestRecovery) {
      backlogRecoveryByTerminal.delete(terminal)
    }
  }
}

export function discardTerminalOutput(terminal: ForegroundTerminalOutputTarget): void {
  exposeTerminalOutputSchedulerDebugApi()
  const entry = queuedByTerminal.get(terminal)
  if (entry) {
    // Why: discarded chunks still consumed their deliveries — credit them or main's in-flight window leaks (fireQueuedAckCredits).
    fireQueuedAckCredits(entry)
  }
  // RA: teardown releases the per-pane parser gate.
  parsingTerminals.delete(terminal)
  parseMsPerChar.delete(terminal)
  discardInFlightTerminalOutputAckCredits(terminal)
  queuedByTerminal.delete(terminal)
  discardForegroundRenderSettle(terminal)
  // Why: cancel the watch without masquerading as parse progress; replay guards use real completions to tell slow from wedged.
  cancelTerminalWriteStallWatch(terminal)
  recordTerminalOutputQueueDebugPressure()
}
