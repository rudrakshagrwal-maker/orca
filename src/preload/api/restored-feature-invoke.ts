import { ipcRenderer } from 'electron'

// RA: only an explicit feature API call crosses the main-process lazy gate.
export async function invokeRestoredFeature(
  feature: 'plugins' | 'automations' | 'session-search' | 'task-providers',
  channel: string,
  ...args: unknown[]
): ReturnType<typeof ipcRenderer.invoke> {
  await ipcRenderer.invoke('features:activate', feature)
  return ipcRenderer.invoke(channel, ...args)
}
