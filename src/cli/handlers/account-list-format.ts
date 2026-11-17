// RA: Remove unused surfaces and their startup dependencies from the lean fork.

type AccountsBlock = {
  accounts: readonly { id: string; email: string; needsSignIn?: true }[]
  activeAccountId: string | null
  activeAccountIdsByRuntime?: {
    host: string | null
    wsl: Record<string, string | null>
  }
}

export function formatAccountsBlock(label: string, block: AccountsBlock): string {
  const hostAccountId = block.activeAccountIdsByRuntime?.host ?? block.activeAccountId
  const system = `  system  System default${hostAccountId === null ? ' (active)' : ''}`
  if (block.accounts.length === 0) {
    return `No managed ${label} accounts.\n${system}`
  }
  const activeAccountIds = new Set([
    block.activeAccountId,
    block.activeAccountIdsByRuntime?.host,
    ...Object.values(block.activeAccountIdsByRuntime?.wsl ?? {})
  ])
  // Why the id: `orca account select --account` needs it when one email signs into several orgs.
  const lines = block.accounts.map(
    (account) =>
      `  ${account.id}  ${account.email}${activeAccountIds.has(account.id) ? ' (active)' : ''}${
        account.needsSignIn ? ' (sign in again in Orca Settings > AI Provider Accounts)' : ''
      }`
  )
  return `Managed ${label} accounts (${block.accounts.length}):\n${system}\n${lines.join('\n')}`
}

/** Antigravity has no system default: one saved account always owns the native login. */
