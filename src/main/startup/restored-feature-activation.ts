import { app, ipcMain } from 'electron'
import { mainProcessState as state } from './main-process-state'

// RA: coalesce first use; importing this gate never imports a feature implementation.
const activations = new Map<string, Promise<void>>()

export function activateRestoredFeature(feature: string): Promise<void> {
  const existing = activations.get(feature)
  if (existing) return existing
  const pending = activate(feature).catch((error) => {
    activations.delete(feature)
    throw error
  })
  activations.set(feature, pending)
  return pending
}

async function activate(feature: string): Promise<void> {
  const { store, runtime } = state
  if (!store || !runtime) throw new Error('Runtime is not ready')
  switch (feature) {
    case 'plugins': {
      const { initializeMainProcessPlugins } = await import('./main-process-plugins.js')
      await initializeMainProcessPlugins(runtime)
      const { registerPluginHandlers } = await import('../ipc/plugins.js')
      if (!state.pluginService || !state.pluginMarketplaceService || !state.pluginMarketplaceInstaller) {
        throw new Error('Plugin services are not ready')
      }
      registerPluginHandlers(store, state.pluginService, {
        marketplace: state.pluginMarketplaceService,
        installer: state.pluginMarketplaceInstaller,
        autoUpdater: state.pluginAutoUpdater ?? undefined,
        reviewNotices: state.pluginUpdateReviewNotices ?? undefined,
        installStats: state.pluginInstallStatsService ?? undefined
      })
      return
    }
    case 'automations': {
      const { initializeMainProcessAutomations } = await import('./main-process-automations.js')
      const service = state.automations ?? initializeMainProcessAutomations()
      const { registerAutomationHandlers } = await import('../ipc/automations.js')
      registerAutomationHandlers(store, service)
      // RA: saved schedules become live only after the first explicit automation use.
      service.start()
      return
    }
    case 'session-search': {
      const { installChildSessionSearchService } = await import('../ai-vault-search/session-search-enablement.js')
      const { sessionSearchScopeCatalogFromStore } = await import('../ai-vault-search/scope/session-search-store-scope-catalog.js')
      const { LOCAL_EXECUTION_HOST_ID } = await import('../../shared/execution-host.js')
      installChildSessionSearchService({
        dataRoot: app.getPath('userData'),
        getSettings: () => store.getSettings(),
        getScopeCatalog: () => sessionSearchScopeCatalogFromStore(store, LOCAL_EXECUTION_HOST_ID)
      })
      const { registerAiVaultSearchHandlers } = await import('../ipc/ai-vault/ai-vault-search.js')
      const { getRuntimeEnvironmentRegistryRoot } = await import('../ipc/runtime-environments/runtime-environment-registry-root.js')
      const { callRuntimeEnvironment } = await import('../ipc/runtime-environments/runtime-environment-transport-routing.js')
      registerAiVaultSearchHandlers({
        callRuntimeSearch: async (environmentId, method, params) => {
          const response = await callRuntimeEnvironment(getRuntimeEnvironmentRegistryRoot(), environmentId, method, params)
          if (!response.ok) throw new Error(response.error.message)
          return response.result
        }
      })
      return
    }
    case 'task-providers': {
      const { registerLinearHandlers } = await import('../ipc/linear/register-handlers.js')
      const { registerJiraHandlers } = await import('../ipc/jira/register-handlers.js')
      registerLinearHandlers()
      registerJiraHandlers()
      return
    }
    default: throw new Error('Unknown restored feature')
  }
}

export function registerRestoredFeatureActivation(): void {
  ipcMain.handle('features:activate', (event, feature: unknown) => {
    // RA: iframe guests cannot activate application services.
    if (event.senderFrame !== event.sender.mainFrame || event.sender.id !== state.mainWindow?.webContents.id ||
      !['plugins', 'automations', 'session-search', 'task-providers'].includes(String(feature))) {
      throw new Error('Invalid feature activation')
    }
    return activateRestoredFeature(String(feature))
  })
}
