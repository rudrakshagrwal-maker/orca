// Keep Electron imports out: both desktop and orcad bundle these account services.

import type { Store } from '../../persistence/loading-store/store'

import { CodexRuntimeHomeService } from '../../codex-accounts/runtime-home-service'
import { CodexAccountService } from '../../codex-accounts/service'
import { ClaudeRuntimeAuthService } from '../../claude-accounts/runtime-auth-service'
import { ClaudeAccountService } from '../../claude-accounts/service'

import type { ClaudeStatusLineRateLimits } from '../../../shared/claude-statusline-rate-limits'

export type ProviderAccountServices = {
  codexRuntimeHome: CodexRuntimeHomeService
  codexAccounts: CodexAccountService
  claudeRuntimeAuth: ClaudeRuntimeAuthService
  claudeAccounts: ClaudeAccountService
}

export function createProviderAccountServices(
  store: Store,
  options: {
    codexAccountLifecycle?: ConstructorParameters<typeof CodexAccountService>[3]
    setClaudeStatusLineListener: (listener: (event: ClaudeStatusLineRateLimits) => void) => void
  }
): ProviderAccountServices {
  const codexRuntimeHome = new CodexRuntimeHomeService(store)
  const codexAccounts = new CodexAccountService(
    store,
    undefined,
    codexRuntimeHome,
    options.codexAccountLifecycle
  )
  const claudeRuntimeAuth = new ClaudeRuntimeAuthService(store)
  const claudeAccounts = new ClaudeAccountService(store, undefined, claudeRuntimeAuth)
  // RA: authentication has no quota polling, credential probes or unused provider setup.
  return { codexRuntimeHome, codexAccounts, claudeRuntimeAuth, claudeAccounts }
}
