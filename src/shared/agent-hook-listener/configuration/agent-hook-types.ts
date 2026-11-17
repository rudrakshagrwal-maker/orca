// Shared renderer IPC/install contract; keep one protocol version for server and per-agent services.

// RA: installation and detection share the fork roster; legacy record types remain readable.
import { FORK_TUI_AGENTS, type TuiAgent } from '../../agent-launch/catalog/tui-agent'
export const AGENT_HOOK_TARGETS = FORK_TUI_AGENTS
export type AgentHookTarget = TuiAgent

export type AgentHookInstallState = 'installed' | 'not_installed' | 'partial' | 'error' | 'skipped'

export type AgentHookInstallSkipReason =
  | 'agent_disabled'
  | 'cli_not_found'
  | 'cli_presence_unknown'
  | 'hooks_disabled'

export type AgentHookInstallStatus = {
  agent: AgentHookTarget
  state: AgentHookInstallState
  configPath: string
  managedHooksPresent: boolean
  detail: string | null
  skipReason?: AgentHookInstallSkipReason
}

// Reserve version bumps for wire changes. Endpoint files are additive; no durable pre-rollout v1 fleet needs distinguishing, and Cursor scripts rewrite on install. Mismatches warn about stale scripts.
export const ORCA_HOOK_PROTOCOL_VERSION = '1' as const

// Why: absence means the listener predates raw-JSON metadata headers, so managed scripts must keep using form posts.
export const ORCA_HOOK_RAW_JSON_TRANSPORT = 'raw-json-v1' as const
