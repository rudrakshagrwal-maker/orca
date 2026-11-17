// RA: Retain Claude and Codex while removing unused integrations and usage tracking.
import type {
  CodexManagedAccount,
  CodexRateLimitAccountsState,
  CodexSystemDefaultIdentity
} from '../../shared/managed-account-types'
import { parseWslUncPath } from '../../shared/wsl-paths'
import type { Store } from '../persistence/loading-store/store'

import type { CodexRuntimeHomeService } from './runtime-home-service'
import type { CodexConfigMirror } from './codex-config-mirror'
import type { ResolvedCodexIdentity } from './codex-account-identity'
import { codexAuthIdentityContradictsAccount } from './codex-auth-identity'
import type { CodexAccountServiceLifecycle } from './codex-account-service-types'
import { toCodexManagedAccountSummary } from './codex-account-service-types'
import {
  getCodexSelectionTargetForAccount,
  normalizeCodexAccountSelectionTarget,
  normalizeCodexRuntimeSelection,
  pruneInvalidCodexRuntimeSelection,
  removeCodexAccountIdFromSelection,
  setSelectedCodexAccountIdForTarget,
  type CodexAccountSelectionTarget
} from './runtime-selection'

type CodexAccountSelectionDependencies = {
  store: Store

  runtimeHome: CodexRuntimeHomeService
  configMirror: CodexConfigMirror
  lifecycle: CodexAccountServiceLifecycle
  resolveSystemDefault: () => CodexSystemDefaultIdentity
  /** Host homes only: `list` reads them synchronously, and never a WSL home. */
  readIdentityFromHostHome: (
    managedHomePath: string,
    expectedAccountId: string
  ) => ResolvedCodexIdentity
  removeManagedHome: (candidatePath: string, expectedAccountId: string) => Promise<void>
}

export class CodexAccountSelection {
  constructor(private readonly dependencies: CodexAccountSelectionDependencies) {}

  list(): CodexRateLimitAccountsState {
    this.normalizeActiveSelection()
    this.adoptManagedHomeIdentities()
    return this.snapshot()
  }

  snapshot(): CodexRateLimitAccountsState {
    const settings = this.dependencies.store.getSettings()
    return {
      accounts: settings.codexManagedAccounts
        .map(toCodexManagedAccountSummary)
        .sort((a, b) => b.updatedAt - a.updatedAt),
      activeAccountId: normalizeCodexRuntimeSelection(settings).host,
      activeAccountIdsByRuntime: normalizeCodexRuntimeSelection(settings),
      systemDefault: this.dependencies.resolveSystemDefault()
    }
  }

  requireAccount(accountId: string): CodexManagedAccount {
    const account = this.dependencies.store
      .getSettings()
      .codexManagedAccounts.find((entry) => entry.id === accountId)
    if (!account) {
      throw new Error('That Codex rate limit account no longer exists.')
    }
    return account
  }

  async remove(accountId: string): Promise<CodexRateLimitAccountsState> {
    const account = this.requireAccount(accountId)
    const settings = this.dependencies.store.getSettings()
    const nextAccounts = settings.codexManagedAccounts.filter((entry) => entry.id !== accountId)
    const nextSelection = removeCodexAccountIdFromSelection(
      normalizeCodexRuntimeSelection(settings),
      accountId
    )
    const nextActiveId =
      settings.activeCodexManagedAccountId === accountId ? null : nextSelection.host

    this.dependencies.store.updateSettings({
      codexManagedAccounts: nextAccounts,
      activeCodexManagedAccountId: nextActiveId,
      activeCodexManagedAccountIdsByRuntime: nextSelection
    })
    this.dependencies.runtimeHome.syncForCurrentSelection()
    if (account.managedHomeRuntime === 'host' && nextSelection.host === null) {
      this.dependencies.lifecycle.onHostSystemDefaultSelected?.()
    }

    await this.dependencies.removeManagedHome(account.managedHomePath, account.id)

    return this.snapshot()
  }

  async select(
    accountId: string | null,
    target?: CodexAccountSelectionTarget
  ): Promise<CodexRateLimitAccountsState> {
    let effectiveTarget = target
    if (accountId !== null) {
      const accountTarget = getCodexSelectionTargetForAccount(this.requireAccount(accountId))
      const requestedTarget = normalizeCodexAccountSelectionTarget(target ?? accountTarget)
      const normalizedAccountTarget = normalizeCodexAccountSelectionTarget(accountTarget)
      if (
        requestedTarget.runtime !== normalizedAccountTarget.runtime ||
        (requestedTarget.wslDistro !== null &&
          requestedTarget.wslDistro !== normalizedAccountTarget.wslDistro)
      ) {
        throw new Error('That Codex account belongs to a different runtime.')
      }
      effectiveTarget = accountTarget
    }

    const previousSettings = this.dependencies.store.getSettings()

    const nextSelection = setSelectedCodexAccountIdForTarget(
      normalizeCodexRuntimeSelection(previousSettings),
      accountId,
      effectiveTarget
    )
    this.dependencies.store.updateSettings({
      activeCodexManagedAccountId:
        effectiveTarget?.runtime === 'wsl' ? nextSelection.host : accountId,
      activeCodexManagedAccountIdsByRuntime: nextSelection
    })
    await this.dependencies.configMirror.safeSyncToManagedHomes()
    this.dependencies.runtimeHome.syncForCurrentSelection(effectiveTarget)
    if (
      accountId === null &&
      normalizeCodexAccountSelectionTarget(effectiveTarget).runtime === 'host'
    ) {
      this.dependencies.lifecycle.onHostSystemDefaultSelected?.()
    }

    return this.snapshot()
  }

  // A `codex login` run inside a managed home swaps its account; label the row with what actually runs (#22284).
  private adoptManagedHomeIdentities(): void {
    const settings = this.dependencies.store.getSettings()
    let changed = false
    const accounts = settings.codexManagedAccounts.map((account) => {
      // WSL homes are read over UNC, which can block when the distro is stopped.
      if (account.managedHomeRuntime === 'wsl' || parseWslUncPath(account.managedHomePath)) {
        return account
      }
      let identity: ResolvedCodexIdentity
      try {
        identity = this.dependencies.readIdentityFromHostHome(account.managedHomePath, account.id)
      } catch {
        return account
      }
      if (!identity.email || !codexAuthIdentityContradictsAccount(identity, account)) {
        return account
      }
      console.warn(
        '[codex-accounts] Managed home holds a different Codex login; updating its label'
      )
      changed = true
      return {
        ...account,
        email: identity.email,
        providerAccountId: identity.providerAccountId,
        workspaceLabel: identity.workspaceLabel,
        workspaceAccountId: identity.workspaceAccountId,
        updatedAt: Date.now()
      }
    })
    if (changed) {
      this.dependencies.store.updateSettings({ codexManagedAccounts: accounts })
    }
  }

  private normalizeActiveSelection(): void {
    const settings = this.dependencies.store.getSettings()
    const selection = normalizeCodexRuntimeSelection(settings)
    const nextSelection = pruneInvalidCodexRuntimeSelection(
      selection,
      settings.codexManagedAccounts
    )
    const changed =
      nextSelection.host !== selection.host ||
      JSON.stringify(nextSelection.wsl) !== JSON.stringify(selection.wsl)
    if (!changed) {
      return
    }
    this.dependencies.store.updateSettings({
      activeCodexManagedAccountId: nextSelection.host,
      activeCodexManagedAccountIdsByRuntime: nextSelection
    })
    if (selection.host !== null && nextSelection.host === null) {
      this.dependencies.lifecycle.onHostSystemDefaultSelected?.()
    }
  }
}
