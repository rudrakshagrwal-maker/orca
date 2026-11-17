// RA: Retain Claude and Codex while removing unused integrations and usage tracking.
import type { ClaudeAccountService } from '../../../claude-accounts/service'

import type {
  ClaudeAccountSignIn,
  ClaudeRateLimitAccountsState,
  ClaudeSignInRequest,
  CodexRateLimitAccountsState
} from '../../../../shared/managed-account-types'
import type { CodexAccountService } from '../../../codex-accounts/service'

import type { CodexAccountSelectionTarget } from '../../../../shared/codex-selection-lane'

import type {
  HostAccountSignInChannel,
  HostAccountSignInProvider,
  HostAccountSignInStatus
} from '../../../../shared/host-account-sign-in-types'

import type { CommitMessageAgentEnvironmentResolvers } from '../../../text-generation/commit-message-agent-environment'
import {
  getClaudeSelectionTargetForAccount,
  getSelectedClaudeAccountIdForTarget,
  type ClaudeAccountSelectionTarget
} from '../../../claude-accounts/runtime-selection'
import {
  hostAccountsManagedByDesktopMessage,
  type HostAccountLaunchEnv
} from '../../../../shared/agent-launch/startup/host-account-launch-env'
import type { HostClaudeProfileRefresh } from './host-claude-profile-refresh'
import { HostAccountLaunchEnvState } from './host-account-launch-env-state'
import type { RuntimeNotifier } from '../../client/events/runtime-notifier-contract'

export type RuntimeAccountServices = {
  claudeAccounts: ClaudeAccountService
  codexAccounts: CodexAccountService
}

export type AccountsSnapshot = {
  claude: ClaudeRateLimitAccountsState
  codex: CodexRateLimitAccountsState
}

type ClaudeSelectionNotifier = Pick<RuntimeNotifier, 'claudeAccountSelected'>

export class RuntimeAccountController {
  private services: RuntimeAccountServices | null = null
  private commitMessageAgentEnvironment: CommitMessageAgentEnvironmentResolvers | null = null
  private readonly hostAccounts = new HostAccountLaunchEnvState(() => this.services !== null)

  constructor(private readonly getNotifier: () => ClaudeSelectionNotifier | null = () => null) {}

  setServices(services: RuntimeAccountServices): void {
    this.services = services
  }

  setCommitMessageAgentEnvironment(resolvers: CommitMessageAgentEnvironmentResolvers): void {
    this.commitMessageAgentEnvironment = resolvers
  }

  getCommitMessageAgentEnvironment(): CommitMessageAgentEnvironmentResolvers | undefined {
    return this.commitMessageAgentEnvironment ?? this.hostAccounts.commitMessageAgentEnvironment()
  }

  /** Refused where this host has account services of its own: they already decide every launch. */
  setHostLaunchEnv(launchEnv: HostAccountLaunchEnv): void {
    this.hostAccounts.setHostLaunchEnv(launchEnv)
  }

  /** orcad's store: starts from the last pushed env, so launches before a reconnect keep it. */
  restoreHostLaunchEnv(
    saved: HostAccountLaunchEnv | null,
    persist: (launchEnv: HostAccountLaunchEnv) => void,
    options: { expectDesktopPush?: boolean; refreshClaudeProfile?: HostClaudeProfileRefresh } = {}
  ): void {
    this.hostAccounts.restoreHostLaunchEnv(saved, persist, options)
  }

  /** Before a launch for `agent` this host starts: the first account push, then a Claude refresh. */
  prepareHostAgentLaunch(agent: string | null | undefined): Promise<void> {
    return this.hostAccounts.prepareHostAgentLaunch(agent)
  }

  /** The desktop-selected account env for a process `agent` starts here; empty when none. */
  hostLaunchEnvFor(agent: string | null | undefined): Readonly<Record<string, string>> {
    return this.hostAccounts.hostLaunchEnvFor(agent)
  }

  /** Null where the desktop that owns this host's accounts polls usage instead (a WSL host). */

  /** Refuses where no poller would read a saved key, so a save is never reported for nothing. */

  getClaudeConfigDirectory(target: ClaudeAccountSelectionTarget): string | null {
    return this.services?.claudeAccounts.getRuntimeConfigDir(target) ?? null
  }

  getSnapshot(): AccountsSnapshot {
    const { claudeAccounts, codexAccounts } = this.requireServices()
    return {
      claude: claudeAccounts.listAccounts(),
      codex: codexAccounts.listAccounts()
    }
  }

  getStreamSnapshot(): AccountsSnapshot {
    const { claudeAccounts, codexAccounts } = this.requireServices()
    return {
      claude: claudeAccounts.listAccounts(),
      codex: codexAccounts.listAccounts()
    }
  }

  /** Desktop switches go through IPC and handle their own sessions; this path tells the window. */
  async selectClaude(
    accountId: string | null,
    options: { movesRunningSessions?: true } = {}
  ): Promise<ClaudeRateLimitAccountsState> {
    const { claudeAccounts } = this.requireServices()
    if (options.movesRunningSessions) {
      return claudeAccounts.selectAccount(accountId)
    }
    const before = claudeAccounts.listAccounts()
    const after = await claudeAccounts.selectAccount(accountId)
    const account = before.accounts.find((candidate) => candidate.id === accountId)
    const target: ClaudeAccountSelectionTarget = account
      ? getClaudeSelectionTargetForAccount(account)
      : { runtime: 'host' }
    this.getNotifier()?.claudeAccountSelected?.({
      target,
      before: { state: before, accountId: selectedClaudeAccountId(before, target) },
      after: { state: after, accountId: selectedClaudeAccountId(after, target) }
    })
    return after
  }

  selectCodex(accountId: string | null): Promise<CodexRateLimitAccountsState> {
    return this.requireServices().codexAccounts.selectAccount(accountId)
  }

  selectCodexForTarget(
    accountId: string | null,
    target: CodexAccountSelectionTarget
  ): Promise<CodexRateLimitAccountsState> {
    return this.requireServices().codexAccounts.selectAccountForTarget(accountId, target)
  }

  removeClaude(accountId: string): Promise<ClaudeRateLimitAccountsState> {
    return this.requireServices().claudeAccounts.removeAccount(accountId)
  }

  beginClaudeSignIn(request: ClaudeSignInRequest): Promise<ClaudeAccountSignIn> {
    return this.requireServices().claudeAccounts.beginSignIn(request)
  }

  finishClaudeSignIn(
    signIn: Omit<ClaudeAccountSignIn, 'configDir'>
  ): Promise<ClaudeRateLimitAccountsState> {
    return this.requireServices().claudeAccounts.finishSignIn(signIn)
  }

  cancelClaudeSignIn(signIn: Omit<ClaudeAccountSignIn, 'configDir'>): Promise<void> {
    return this.requireServices().claudeAccounts.cancelSignIn(signIn)
  }

  /** Adds a host account whose login a client on another device finishes. */
  async runHostSignIn(
    provider: HostAccountSignInProvider,
    channel: HostAccountSignInChannel
  ): Promise<Pick<HostAccountSignInStatus, 'claude' | 'codex'>> {
    const { claudeAccounts, codexAccounts } = this.requireServices()
    return provider === 'claude'
      ? { claude: await claudeAccounts.addAccountWithPastedCode(channel) }
      : { codex: await codexAccounts.addAccountWithDeviceCode(channel) }
  }

  removeCodex(accountId: string): Promise<CodexRateLimitAccountsState> {
    return this.requireServices().codexAccounts.removeAccount(accountId)
  }

  addCodexFromHome(
    sourceHome: string,
    target?: { runtime?: 'host' | 'wsl'; wslDistro?: string | null }
  ): Promise<CodexRateLimitAccountsState> {
    return this.requireServices().codexAccounts.addAccountFromHome(sourceHome, target)
  }

  private requireServices(): RuntimeAccountServices {
    if (!this.services) {
      throw new Error(
        this.hostAccounts.current
          ? hostAccountsManagedByDesktopMessage(this.hostAccounts.current.wslDistro)
          : 'Account services are not configured on this runtime'
      )
    }
    return this.services
  }
}

function selectedClaudeAccountId(
  state: ClaudeRateLimitAccountsState,
  target: ClaudeAccountSelectionTarget
): string | null {
  return getSelectedClaudeAccountIdForTarget(
    {
      activeClaudeManagedAccountId: state.activeAccountId,
      activeClaudeManagedAccountIdsByRuntime: state.activeAccountIdsByRuntime
    },
    target
  )
}
