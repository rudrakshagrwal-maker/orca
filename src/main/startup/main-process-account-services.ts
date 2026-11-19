import { app } from 'electron'
import { KeybindingService } from '../keybindings/keybinding-service'
import { createProviderAccountServices } from '../providers/accounts/provider-account-services'
import { agentHookServer } from '../agent-hooks/server/agent-hook-server'
import { mainProcessState as state } from './main-process-state'

export function initializeMainProcessAccountServices(): void {
  const store = state.store
  // RA: authentication does not depend on usage tracking.
  if (!store) {
    throw new Error('Store must be initialized before account services')
  }
  // RA: terminal auth never imports session migration, model discovery or unused providers.
  const services = createProviderAccountServices(store, {
    setClaudeStatusLineListener: (listener) => agentHookServer.setClaudeStatusLineListener(listener)
  })
  state.codexRuntimeHome = services.codexRuntimeHome
  state.codexAccounts = services.codexAccounts
  state.claudeRuntimeAuth = services.claudeRuntimeAuth
  state.claudeAccounts = services.claudeAccounts
  state.rateLimits = services.rateLimits
  state.keybindings = new KeybindingService({
    homePath: app.getPath('home'),
    getLegacyOverrides: () => store.getSettings().keybindings,
    legacyTabSwitchDefaults: store.getSettings().tabSwitchKeybindingSeed === 'legacy',
    legacySearchDefaults:
      (process.platform === 'darwin'
        ? store.getSettings().searchKeybindingSeed
        : store.getSettings().nonMacSearchKeybindingSeed) === 'legacy'
  })
}
