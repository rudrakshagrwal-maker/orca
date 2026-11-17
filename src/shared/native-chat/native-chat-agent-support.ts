import { FORK_TUI_AGENTS, isForkTuiAgent, type TuiAgent } from '../agent-launch/catalog/tui-agent'

export type NativeChatTranscriptAgent = 'claude' | 'codex' | 'grok' | 'omp' | 'opencode'

/** Agents whose transcripts the native chat view can parse and render. */
// RA: transcript entry points follow the same launch allow-list.
export const NATIVE_CHAT_SUPPORTED_AGENT_LIST: readonly TuiAgent[] = FORK_TUI_AGENTS

export const NATIVE_CHAT_SUPPORTED_AGENTS: ReadonlySet<string> = new Set(
  NATIVE_CHAT_SUPPORTED_AGENT_LIST
)

export function isNativeChatSupportedAgent(agent: string | null | undefined): boolean {
  return agent != null && NATIVE_CHAT_SUPPORTED_AGENTS.has(agent)
}

/** Agents whose Model-A SSH transcript reader is not supported. A hook path alone
 *  does not establish owning-host reads, so OMP remains gated even with metadata. */
export function nativeChatRequiresLocalTranscript(agent: string | null | undefined): boolean {
  const transcriptAgent = resolveNativeChatTranscriptAgent(agent)
  return transcriptAgent === 'grok' || transcriptAgent === 'omp' || transcriptAgent === 'opencode'
}

/** Selector TUIs require key steps rather than pasted option labels. */
export function shouldStepNativeChatAskAnswer(agent: string | null | undefined): boolean {
  const transcriptAgent = resolveNativeChatTranscriptAgent(agent)
  return (
    transcriptAgent === 'claude' || transcriptAgent === 'codex' || transcriptAgent === 'opencode'
  )
}

/** OMP's configurable keys and existing checkbox state cannot be replaced through PTY input. */
export function nativeChatAskRequiresTerminal(agent: string | null | undefined): boolean {
  return resolveNativeChatTranscriptAgent(agent) === 'omp'
}

/** OpenCode confirms an interrupt with a second Escape; Claude Code and Codex read Esc-Esc at an idle prompt as rewind. */
export function nativeChatStopSendsSecondEscape(agent: string | null | undefined): boolean {
  return resolveNativeChatTranscriptAgent(agent) === 'opencode'
}

export function resolveNativeChatTranscriptAgent(
  agent: string | null | undefined
): NativeChatTranscriptAgent | null {
  // RA: only retained integrations have a transcript reader.
  return isForkTuiAgent(agent) ? agent : null
}

export function nativeChatApprovalAcceptKey(agent: string | null | undefined): string {
  return resolveNativeChatTranscriptAgent(agent) === 'opencode' ? '\r' : '1'
}
