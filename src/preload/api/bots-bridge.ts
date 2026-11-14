// RA: No arbitrary command or host crosses this bridge.
import { ipcRenderer } from 'electron'
import type { BotsApi } from './bots-api'
export const botsApi: BotsApi = {
  open: (input) => ipcRenderer.invoke('bots:open', input),
  list: (refresh) => ipcRenderer.invoke('bots:list', refresh),
  launch: (key, sessionId) => ipcRenderer.invoke('bots:launch', key, sessionId)
}
