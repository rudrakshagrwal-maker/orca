import { isForkTuiAgent } from '../../../shared/agent-launch/catalog/tui-agent'
// RA: unsupported hooks are neither imported nor registered.
import type { AgentHookInstallStatus } from '../../../shared/agent-hook-listener/configuration/agent-hook-types'
import type { HookInstallAgent } from '../../../shared/telemetry-daemon-event-schemas'
import { claudeHookService } from '../../claude/hook-service'
import { codexHookService } from '../../codex/hooks/installation/hook-service'

export type ManagedAgentHookInstallOptions = { userInitiated?: boolean; cliVersion?: string }
export type ManagedAgentHookInstaller = readonly [
  HookInstallAgent,
  (
    options?: ManagedAgentHookInstallOptions
  ) => AgentHookInstallStatus | Promise<AgentHookInstallStatus>
]
export type ManagedAgentHookScriptRefresher = readonly [HookInstallAgent, () => Promise<void>]
export type ManagedAgentHookRemover = readonly [
  HookInstallAgent,
  () => AgentHookInstallStatus | Promise<AgentHookInstallStatus>
]
export type ManagedAgentHookAsyncRemover = readonly [
  HookInstallAgent,
  () => Promise<AgentHookInstallStatus>
]
export type ManagedAgentHookStatusReader = readonly [HookInstallAgent, () => AgentHookInstallStatus]

export const MANAGED_AGENT_HOOK_INSTALLERS: readonly ManagedAgentHookInstaller[] = (
  [
    ['claude', (options) => claudeHookService.install({ claudeVersion: options?.cliVersion })],
    ['codex', () => codexHookService.reconcileHooks()]
  ] satisfies readonly ManagedAgentHookInstaller[]
).filter(([agent]) => isForkTuiAgent(agent))

// RA: refresh only the supported agents' managed launchers.
export const MANAGED_AGENT_HOOK_SCRIPT_REFRESHERS: readonly ManagedAgentHookScriptRefresher[] = (
  [
    ['claude', () => claudeHookService.refreshManagedScripts()],
    ['codex', () => codexHookService.refreshManagedScripts()]
  ] satisfies readonly ManagedAgentHookScriptRefresher[]
).filter(([agent]) => isForkTuiAgent(agent))

export const MANAGED_AGENT_HOOK_REMOVERS: readonly ManagedAgentHookRemover[] = (
  [
    ['claude', () => claudeHookService.remove()],
    ['codex', () => codexHookService.remove()]
  ] satisfies readonly ManagedAgentHookRemover[]
).filter(([agent]) => isForkTuiAgent(agent))

export const MANAGED_AGENT_HOOK_ASYNC_REMOVERS: readonly ManagedAgentHookAsyncRemover[] = []

export const MANAGED_AGENT_HOOK_STATUS_READERS: readonly ManagedAgentHookStatusReader[] = (
  [
    ['claude', () => claudeHookService.getStatus()],
    ['codex', () => codexHookService.getStatus()]
  ] satisfies readonly ManagedAgentHookStatusReader[]
).filter(([agent]) => isForkTuiAgent(agent))
