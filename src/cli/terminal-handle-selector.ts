import type { RuntimeTerminalListResult, RuntimeTerminalSummary } from '../shared/runtime-types'
import { RuntimeClientError } from './runtime/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SESSION_ID =
  /^[a-z][a-z0-9-]*_[0-9a-f]{8}[-_][0-9a-f]{4}[-_][0-9a-f]{4}[-_][0-9a-f]{4}[-_][0-9a-f]{12}$/i

// RA: resolve abbreviations once per invocation on the selected host, never across hosts.
export class TerminalHandleSelector {
  private listing: Promise<RuntimeTerminalListResult> | undefined

  constructor(private readonly list: () => Promise<RuntimeTerminalListResult>) {}

  async resolve(value: string): Promise<string> {
    const bare = value.replace(/^term_/i, '')
    if (UUID.test(bare)) return `term_${bare.toLowerCase()}`
    // Preserve opaque legacy handles and session addresses, including closed-pane exit waits.
    if (
      /^(?:orca_session_id:|structworker_|term-)/.test(value) ||
      (/^term_/i.test(value) && !/^[0-9a-f-]+$/i.test(bare))
    ) {
      return value
    }
    this.listing ??= this.list()
    const result = await this.listing
    // An incomplete inventory cannot prove uniqueness.
    if (result.truncated) {
      throw new RuntimeClientError(
        'terminal_selector_incomplete',
        'Terminal inventory was truncated. Use a full terminal handle.'
      )
    }
    return matchTerminalHandle(value, result.terminals)
  }

  async params(method: string, params: unknown): Promise<unknown> {
    if (!params || typeof params !== 'object' || Array.isArray(params)) return params
    const record = params as Record<string, unknown>
    const keys = ['terminal', 'parentTerminalHandle']
    if (method === 'terminal.setParent') keys.push('parent')
    if (method.startsWith('orchestration.')) keys.push('from', 'to')
    let resolved = record
    for (const key of keys) {
      const value = record[key]
      if (typeof value !== 'string' || !value) continue
      // RA: mail groups and durable session/run/dispatch addresses are not terminal selectors.
      if (
        (key === 'from' || key === 'to') &&
        (/^(?:@|run:|dispatch:)/.test(value) || SESSION_ID.test(value))
      ) continue
      const handle = await this.resolve(value)
      if (handle !== value) resolved = { ...resolved, [key]: handle }
    }
    return resolved
  }
}

// RA: exact handles win; a prefix/title collision is ambiguous, never silently picked.
export function matchTerminalHandle(
  value: string,
  terminals: readonly RuntimeTerminalSummary[]
): string {
  const wanted = value.toLowerCase()
  const exact = terminals.find((terminal) => terminal.handle.toLowerCase() === wanted)
  if (exact) return exact.handle
  const prefix = wanted.replace(/^term_/, '')
  const matches = terminals.filter(
    (terminal) =>
      terminal.handle.replace(/^term_/i, '').toLowerCase().startsWith(prefix) ||
      terminal.title?.toLowerCase().includes(wanted) ||
      terminal.paneTitle?.toLowerCase().includes(wanted)
  )
  if (matches.length === 1) return matches[0].handle
  const choices = matches.map((terminal) => ({
    handle: terminal.handle,
    title: terminal.title,
    paneTitle: terminal.paneTitle
  }))
  const descriptions = choices
    .map((choice) => `  ${choice.handle}  ${choice.paneTitle ?? choice.title ?? '(untitled)'}`)
    .join('\n')
  throw new RuntimeClientError(
    matches.length ? 'terminal_selector_ambiguous' : 'terminal_selector_not_found',
    matches.length
      ? `Ambiguous terminal "${value}":\n${descriptions}`
      : `No terminal matches "${value}". Run orca terminal list.`,
    { matches: choices }
  )
}
