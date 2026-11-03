import type { App } from 'electron'

// RA: Leave official Orca's protocol handler alone; this fork opens local work directly.
const REGISTER_ORCA_PROTOCOL = false

/**
 * Registers `orca://` with Windows, which NSIS installs leave unregistered; macOS reads it from
 * Info.plist and Linux packages from the desktop entry. Only packaged desktop launches register,
 * so dev, test and serve runs never take over the machine's handler.
 */
export function registerOrcaProtocolClient(
  app: Pick<App, 'isPackaged' | 'isDefaultProtocolClient' | 'setAsDefaultProtocolClient'>,
  options: { platform: NodeJS.Platform; desktopLaunch: boolean }
): boolean {
  if (
    !REGISTER_ORCA_PROTOCOL ||
    options.platform !== 'win32' ||
    !app.isPackaged ||
    !options.desktopLaunch
  ) {
    return false
  }
  if (app.isDefaultProtocolClient('orca')) {
    return false
  }
  try {
    return app.setAsDefaultProtocolClient('orca')
  } catch (error) {
    console.warn('[protocol] Failed to register orca:// links:', error)
    return false
  }
}
