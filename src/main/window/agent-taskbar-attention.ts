import type { BrowserWindow } from 'electron'
import type { AgentHookServer } from '../agent-hooks/server'

// RA: Only live OSC 7501 permission edges request local Windows attention.
export function installAgentTaskbarAttention(
  window: Pick<BrowserWindow, 'isDestroyed' | 'isFocused' | 'flashFrame' | 'on' | 'removeListener'>,
  statuses: Pick<AgentHookServer, 'subscribeEnrichedStatus' | 'subscribePaneStatusClear'>,
  platform: NodeJS.Platform = process.platform
): () => void {
  if (platform !== 'win32') {
    return () => {}
  }
  const permissions = new Map<string, string | null>()
  const stopFlashing = (): void => {
    if (!window.isDestroyed()) {
      window.flashFrame(false)
    }
  }
  const unsubscribe = statuses.subscribeEnrichedStatus((event) => {
    if (event.isReplay || event.restoredUnconfirmed || event.providerSessionOnly) {
      return
    }
    const permission =
      event.programStatus?.state === 'blocked' && event.programStatus.kind === 'permission'
    const wasPermission = permissions.has(event.paneKey)
    if (permission) {
      permissions.set(event.paneKey, event.connectionId)
    } else {
      permissions.delete(event.paneKey)
    }
    if (permission && !wasPermission && !window.isDestroyed() && !window.isFocused()) {
      window.flashFrame(true)
    }
  })
  const unsubscribeClear = statuses.subscribePaneStatusClear((clear) => {
    if ('paneKey' in clear) {
      permissions.delete(clear.paneKey)
    } else {
      for (const [paneKey, connectionId] of permissions) {
        if (connectionId === clear.connectionId) {
          permissions.delete(paneKey)
        }
      }
    }
  })
  window.on('focus', stopFlashing)
  return () => {
    unsubscribe()
    unsubscribeClear()
    window.removeListener('focus', stopFlashing)
    permissions.clear()
    stopFlashing()
  }
}
