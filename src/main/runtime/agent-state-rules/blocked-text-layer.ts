import { escapeRegex } from '../../../shared/string-utils'
import { findStartupDialogBlockedSignals } from '../terminal/wait/startup-dialog-blocked-signals'
import { startOfLastNonBlankLines } from '../terminal/wait/terminal-wait-tail-window'
import { compiledFromActiveAgentStateRules } from './active-agent-state-rules'
import {
  blockedAnchorLiterals,
  findBlockedAnchorSignals,
  showsHoldAnchor,
  type BlockedTextSignal
} from './agent-state-text-anchors'

// Any pane can contain another agent's dialog; the latest live blocker wins.

const BUILT_IN_SENTINEL_RE =
  /update available|choose working directory to|codex just got an upgrade|available\s*\u00B7|esc\s*skip|enter\s*confirm\s*\u00B7|enter\/esc\s*(?:continue|confirm)|hooks need review|do you trust|trust this|trusted workspace|press enter to (?:confirm|continue|view|insert)|press t to trust|new\s*mcp\s*servers?\s*found|custom\s*api\s*key|bypass\s*permissions\s*mode|external\s*claude\.md|permission required|requires permission|allow once|allow always|requests\s*your\s*input|allow command\?|enter to submit (?:answer|all)|press enter to confirm or esc to cancel/

/** Cheap negative test; identity remains stable until rules change for caller caches. */
export const terminalWaitBlockedSentinelRe = compiledFromActiveAgentStateRules(
  () =>
    new RegExp(
      [BUILT_IN_SENTINEL_RE.source, ...blockedAnchorLiterals().map(escapeRegex)].join('|'),
      'i'
    )
)

// Restrict to the screen bottom: answered dialogs and quoted prompts remain in scrollback.
// Twelve lines cover 4–8-line Codex dialogs plus wrapped commands/hooks.
const LIVE_PROMPT_TAIL_LINES = 12

/** `wholeText` scans every line: a grid holds only what is painted, and a tall dialog's keyword sits above the window. */
export function findTerminalWaitBlockedSignal(
  fullTail: string,
  options: { wholeText?: boolean } = {}
): BlockedTextSignal | null {
  const windowStart = options.wholeText
    ? 0
    : startOfLastNonBlankLines(fullTail, LIVE_PROMPT_TAIL_LINES)
  const normalized = windowStart === 0 ? fullTail : fullTail.slice(windowStart)
  if (!terminalWaitBlockedSentinelRe().test(normalized)) {
    return null
  }
  const signal = findBlockedSignalInLiveWindow(normalized)
  // Convert the live-window index to full-tail coordinates for ready-header comparison.
  return signal === null ? null : { reason: signal.reason, index: signal.index + windowStart }
}

export function isUnblockedAfter(normalized: string, readyIndex: number | null): boolean {
  if (readyIndex === null) {
    return false
  }
  const blockedSignal = findTerminalWaitBlockedSignal(normalized)
  return blockedSignal === null || blockedSignal.index <= readyIndex
}

export function isSettledAfter(normalized: string, readyIndex: number | null): boolean {
  return isUnblockedAfter(normalized, readyIndex) && !showsHoldAnchor(normalized)
}

function findBlockedSignalInLiveWindow(normalized: string): BlockedTextSignal | null {
  const candidates = findStartupDialogBlockedSignals(normalized)
  const trustIndex = Math.max(
    normalized.lastIndexOf('do you trust'),
    normalized.lastIndexOf('trust this'),
    normalized.lastIndexOf('trusted workspace')
  )
  const trustSegment = trustIndex === -1 ? '' : normalized.slice(trustIndex)
  if (
    trustIndex !== -1 &&
    (trustSegment.includes('workspace') ||
      trustSegment.includes('folder') ||
      trustSegment.includes('directory') ||
      trustSegment.includes('repo'))
  ) {
    // Workspace-trust wording identifies no particular agent.
    candidates.push({ reason: 'agent-trust-workspace', index: trustIndex })
  }
  const interactivePromptIndex = Math.max(
    normalized.lastIndexOf('press enter to confirm'),
    normalized.lastIndexOf('press enter to continue'),
    normalized.lastIndexOf('press enter to view'),
    normalized.lastIndexOf('press enter to insert'),
    normalized.lastIndexOf('press t to trust')
  )
  const interactivePromptContext =
    interactivePromptIndex === -1
      ? ''
      : normalized.slice(Math.max(0, interactivePromptIndex - 600), interactivePromptIndex + 200)
  // Codex in scrollback widens dialog detection but cannot identify the pane's agent.
  const hasInteractiveDialogContext =
    interactivePromptContext.includes('codex') ||
    interactivePromptContext.includes('permission') ||
    interactivePromptContext.includes('sandbox') ||
    interactivePromptContext.includes('trust') ||
    interactivePromptContext.includes('hook')
  // RA: live while no composer row sits under it and it is within the last 8 rows (options may follow the line);
  // an answered dialog leaves the composer below.
  if (
    interactivePromptIndex !== -1 &&
    hasInteractiveDialogContext &&
    isLiveBelow(normalized, interactivePromptIndex, INTERACTIVE_PROMPT_TRAILING_LINES)
  ) {
    const contextStart = Math.max(0, interactivePromptIndex - 600)
    const hasSpecificPromptInContext = candidates.some(
      (candidate) => candidate.index >= contextStart && candidate.index <= interactivePromptIndex
    )
    if (!hasSpecificPromptInContext) {
      candidates.push({ reason: 'agent-interactive-prompt', index: interactivePromptIndex })
    }
  }
  candidates.push(...findBlockedAnchorSignals(normalized))
  const codexPromptIndex = findLiveCodexPromptIndex(normalized)
  if (codexPromptIndex !== -1) {
    candidates.push({ reason: 'agent-interactive-prompt', index: codexPromptIndex })
  }
  const mcpDialogIndex = findLiveMcpElicitationIndex(normalized)
  if (mcpDialogIndex !== -1) {
    candidates.push({ reason: 'agent-interactive-prompt', index: mcpDialogIndex })
  }
  const permissionPromptIndex = Math.max(
    normalized.lastIndexOf('permission required'),
    normalized.lastIndexOf('requires permission')
  )
  if (permissionPromptIndex !== -1) {
    const permissionSegment = normalized.slice(permissionPromptIndex, permissionPromptIndex + 1_500)
    const decisionCount = ['allow once', 'allow always', 'reject', 'deny'].filter((choice) =>
      permissionSegment.includes(choice)
    ).length
    if (decisionCount >= 2) {
      // Named choices identify no agent; retain the old codex-* alias for mixed-version receipts.
      // Rule 1 additive member: RuntimeTerminalWaitBlockedReason has no exhaustive consumers (remote-wire-compatibility.md).
      candidates.push({ reason: 'agent-interactive-prompt', index: permissionPromptIndex })
    }
  }
  return candidates.length > 0
    ? candidates.reduce((latest, candidate) =>
        candidate.index > latest.index ? candidate : latest
      )
    : null
}

// RA: Claude's MCP elicitation dialog (herdr claude.toml mcp_elicitation_prompt): header, Accept/Decline, `esc to cancel`.
// Tails fold words together under cell-diff painting, so spaces are optional. Hook-free Claude shows no other signal.
const MCP_ELICITATION_HEADER_RE = new RegExp(String.raw`mcp\s*server\s*["\u201C'][^\n]*["\u201D']\s*requests\s*your\s*input`, 'g')
// Live only while the cancel footer ends the tail; an answered or quoted dialog has the prompt box and status row after it.
const LIVE_DIALOG_FOOTER_TRAILING_LINES = 2

const CANCEL_FOOTER_RE = new RegExp(String.raw`esc\s*to\s*cancel`, 'g')

function lastCancelFooter(segment: string): number {
  let end = -1
  for (const match of segment.matchAll(CANCEL_FOOTER_RE)) {
    end = match.index + match[0].length
  }
  return end
}

function findLiveMcpElicitationIndex(normalized: string): number {
  let header = -1
  for (const match of normalized.matchAll(MCP_ELICITATION_HEADER_RE)) {
    header = match.index
  }
  if (header === -1) {
    return -1
  }
  const segment = normalized.slice(header)
  const footer = lastCancelFooter(segment)
  const choices = segment.indexOf('accept') !== -1 || segment.indexOf('decline') !== -1
  if (footer === -1 || !choices) {
    return -1
  }
  const trailing = segment
    .slice(footer)
    .split('\n')
    .filter((line) => line.trim() !== '')
  return trailing.length <= LIVE_DIALOG_FOOTER_TRAILING_LINES ? header : -1
}

const NEWLINE = String.fromCharCode(10)

// RA: herdr codex.toml live_strong_blocker. Codex approval and question dialogs end the screen with these rows;
// the permission wording above covers only `permission required`, so an approval prompt read as idle.
const CODEX_LIVE_PROMPT_QUESTION = 'allow command?'
const CODEX_LIVE_PROMPT_FOOTERS = [
  'press enter to confirm or esc to cancel',
  'enter to submit answer',
  'enter to submit all'
]
const CODEX_QUESTION_TRAILING_LINES = 8
const CODEX_FOOTER_TRAILING_LINES = 2
const INTERACTIVE_PROMPT_TRAILING_LINES = 8

function findLiveCodexPromptIndex(normalized: string): number {
  // Why: an answered dialog scrolls up and leaves the composer and status rows below it.
  const question = normalized.lastIndexOf(CODEX_LIVE_PROMPT_QUESTION)
  // RA: the question also needs no composer row below it.
  let latest =
    question !== -1 && isLiveBelow(normalized, question, CODEX_QUESTION_TRAILING_LINES)
      ? question
      : -1
  for (const footer of CODEX_LIVE_PROMPT_FOOTERS) {
    const index = normalized.lastIndexOf(footer)
    if (index !== -1 && isFooterLive(normalized, index)) {
      latest = Math.max(latest, index)
    }
  }
  return latest
}

const COMPOSER_ROW_RE = new RegExp(String.raw`^\s*\u203A`)

/** The footer is within the last 2 non-empty rows and no Codex composer row follows it. */
function isFooterLive(normalized: string, footerIndex: number): boolean {
  return isLiveBelow(normalized, footerIndex, CODEX_FOOTER_TRAILING_LINES)
}

/** RA: at most `maxRows` non-empty rows follow the index and none is a composer row. */
function isLiveBelow(normalized: string, index: number, maxRows: number): boolean {
  const rows = normalized
    .slice(index)
    .split(NEWLINE)
    .filter((line) => line.trim() !== '')
  return rows.length - 1 <= maxRows && !rows.slice(1).some((row) => COMPOSER_ROW_RE.test(row))
}
