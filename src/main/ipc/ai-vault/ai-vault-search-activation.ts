import { app, ipcMain } from 'electron'
import type { Store } from '../../persistence/loading-store/store'
import { activateSessionSearch } from '../../ai-vault-search/session-search-activation'
import { mainProcessState } from '../../startup/main-process-state'

export function registerSessionSearchActivation(store: Store): void {
  let pending: Promise<void> | undefined
  ipcMain.handle('aiVault:activateSearch', (event) => {
    if (
      event.senderFrame !== event.sender.mainFrame ||
      event.sender.id !== mainProcessState.mainWindow?.webContents.id
    ) {
      throw new Error('Session search must be opened by the main window')
    }
    pending ??= activate(store).catch((error) => {
      pending = undefined
      throw error
    })
    return pending
  })
}

async function activate(store: Store): Promise<void> {
  await activateSessionSearch(store, app.getPath('userData'))
  const { registerAiVaultSearchHandlers } = await import('./ai-vault-search')
  const { getRuntimeEnvironmentRegistryRoot } =
    await import('../runtime-environments/runtime-environment-registry-root')
  const { callRuntimeEnvironment } =
    await import('../runtime-environments/runtime-environment-transport-routing')
  registerAiVaultSearchHandlers({
    callRuntimeSearch: async (environmentId, method, params) => {
      const response = await callRuntimeEnvironment(
        getRuntimeEnvironmentRegistryRoot(),
        environmentId,
        method,
        params
      )
      if (!response.ok) {
        throw new Error(response.error.message)
      }
      return response.result
    }
  })
}
