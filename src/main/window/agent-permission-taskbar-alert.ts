import type { BrowserWindow } from 'electron'
import type { ProgramStatusFacet } from '../../shared/program-status/facet'

// RA: OSC permission transitions get one silent taskbar request, never a toast or network call.
export function createAgentPermissionTaskbarAlert(
  window: Pick<BrowserWindow, 'isDestroyed' | 'isFocused' | 'flashFrame' | 'on' | 'removeListener'>,
  platform: NodeJS.Platform = process.platform
) {
  const blockedPanes = new Set<string>()
  const stop = (): void => {
    if (platform === 'win32' && !window.isDestroyed()) {
      window.flashFrame(false)
    }
  }
  window.on('focus', stop)
  return {
    observe(paneKey: string, status: ProgramStatusFacet | undefined, replay = false): void {
      const blocked = status?.state === 'blocked' && status.kind === 'permission'
      const wasBlocked = blockedPanes.has(paneKey)
      if (blocked) {
        blockedPanes.add(paneKey)
      } else {
        blockedPanes.delete(paneKey)
      }
      if (
        blocked && !wasBlocked && !replay && platform === 'win32' &&
        !window.isDestroyed() && !window.isFocused()
      ) {
        window.flashFrame(true)
      }
    },
    clear(paneKey: string): void {
      blockedPanes.delete(paneKey)
    },
    dispose(): void {
      window.removeListener('focus', stop)
      stop()
    }
  }
}
