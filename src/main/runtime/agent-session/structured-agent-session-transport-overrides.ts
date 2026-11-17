// RA: Retain Claude and Codex while removing unused integrations and usage tracking.
import type { CodexModelCatalogProbeDeps } from '../../codex/structured/catalog/codex-model-catalog-probe'

import type { ClaudeStructuredSessionAdapterDeps } from '../../claude/structured/claude-structured-session-state'
import type { CodexStructuredSessionAdapterDeps } from '../../codex/structured/session-lifecycle/codex-structured-session-state'
import type { AgentCliVersionReader } from '../../agent-launch/preflight/agent-cli-version-probe'
import type { StructuredAgentSessionStartupLimits } from '../../native-chat/agent-session-wire/startup/structured-agent-session-startup-attempt-contract'

/** Provider transports are overridden only to drive the runtime against scripted children. */
export type StructuredAgentSessionTransportOverrides = {
  /** Scripted Pi children resolve their launch here, so no test reaches a real Pi binary. */

  openCodexConnection?: CodexStructuredSessionAdapterDeps['openConnection']
  /** Independent discovery uses its own short-lived transport, separate from chat children. */
  runCodexCatalogSession?: CodexModelCatalogProbeDeps['runSession']
  /** Scripted transports must also replace the real host's version probe. */
  readCodexInstallation?: AgentCliVersionReader

  /** Replace command lookup/version probing for scripted ACP children; unset uses the real binary. */

  openClaudeConnection?: ClaudeStructuredSessionAdapterDeps['openConnection']
  /** Scripted app-servers carry fake pids the real start-time read cannot answer for. */
  readProcessStartTime?: CodexStructuredSessionAdapterDeps['readProcessStartTime']
  /** The shipped startup limits unless a test shortens them. */
  startupLimits?: Partial<StructuredAgentSessionStartupLimits>
}
