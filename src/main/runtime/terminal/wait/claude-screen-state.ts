// RA: hook-free Claude screen predicates, ported from herdr's claude.toml. They read only the
// painted bottom of the screen, so dialog or busy text quoted in scrollback never triggers.
// Why String.raw + escapes: the orcad bundle must stay ASCII.

const NON_EMPTY_TAIL = 12
const HEADER_RE = new RegExp(
  String.raw`^\s*MCP server ["\u201C].+["\u201D] requests your input\s*$`,
  'i'
)
const ACCEPT_DECLINE_RE = new RegExp(String.raw`^\s*\u276F?\s*(?:Accept|Decline)\b`)
const INTERRUPT_ROW_RE = new RegExp(
  String.raw`^\s*[\u23F8\u23F5].*esc to interrupt(?:\s|\u00B7|$)`,
  'i'
)
const SPINNER_ROW_RE = new RegExp(
  String.raw`^\s*[*\u00B7\u2722\u2733\u2736\u273B\u273D]\s+\S.*\u2026(?:\s+\(\d+[smh](?:\s|\u00B7)|\s*$)`
)
const BACKGROUND_AGENTS_RE = new RegExp(
  String.raw`^\s*[*\u00B7\u2722\u2736\u273B\u273D]\s+Waiting for [1-9]\d* background agents? to finish\s*$`
)
// Activity summaries sit at column zero; wrapped continuations are indented, so prompt text cannot fake one.
const MCP_TASKS_RE = new RegExp(
  String.raw`^[*\u00B7\u2722\u2736\u273B\u273D][ \t]+\S[^\n]*?(?:\n[ \t]+[^\n]*?){0,3}\u00B7(?:[ \t]+|\n[ \t]*)[1-9]\d*(?:[ \t]+|\n[ \t]*)MCP(?:[ \t]+|\n[ \t]*)tasks?(?:[ \t]+|\n[ \t]*)still(?:[ \t]+|\n[ \t]*)running[ \t]*$`,
  'm'
)

function tail(lines: readonly string[], count: number): string[] {
  return lines.filter((line) => line.trim() !== '').slice(-count)
}

/** A live Claude input dialog or overlay owns the keyboard: MCP elicitation, selection forms, plan/workflow prompts,
 *  the transcript viewer, the model picker and the /btw overlay. The footer must end the screen: an answered or
 *  quoted dialog in history has the prompt box and status row painted below it. */
export function isClaudeInputDialogScreen(lines: readonly string[]): boolean {
  const end = tail(lines, 4).map((line) => line.toLowerCase())
  const endText = end.join('\n')
  if (endText.includes('showing detailed transcript')) {
    return true
  }
  if (tail(lines, 5).some((line) => /esc to close\s*$/i.test(line))) {
    return true
  }
  if (!endText.includes('esc to cancel')) {
    return false
  }
  const recent = tail(lines, 14)
  const header = recent.findLastIndex((line) => HEADER_RE.test(line))
  if (header !== -1 && recent.slice(header + 1).some((line) => ACCEPT_DECLINE_RE.test(line))) {
    return true
  }
  const formKeys =
    endText.includes('enter to confirm') ||
    (endText.includes('enter to select') &&
      new RegExp(String.raw`(?:arrow keys|arrows|\u2191/?\u2193) to navigate`).test(endText))
  const recentText = recent.join('\n').toLowerCase()
  return (
    formKeys ||
    recentText.includes('run a dynamic workflow?') ||
    (recentText.includes('select model') && recentText.includes('enter to set as default'))
  )
}

/** The agent's own live status row says a turn, background agent or MCP task is still running. */
export function isClaudeBusyScreen(lines: readonly string[]): boolean {
  const region = tail(lines, NON_EMPTY_TAIL)
  if (region.some((line) => INTERRUPT_ROW_RE.test(line) || SPINNER_ROW_RE.test(line))) {
    return true
  }
  if (region.some((line) => BACKGROUND_AGENTS_RE.test(line))) {
    return true
  }
  const text = region.join('\n')
  return MCP_TASKS_RE.test(text) && !isClaudePermissionText(text.toLowerCase())
}

function isClaudePermissionText(text: string): boolean {
  return [
    'do you want to proceed?',
    'esc to cancel',
    'waiting for permission',
    'do you want to allow this connection?',
    'tab to amend',
    'ctrl+e to explain'
  ].some((marker) => text.includes(marker))
}
