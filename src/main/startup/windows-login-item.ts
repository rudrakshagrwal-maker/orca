// RA: Only the installed stable fork may register itself, retaining its local profile.
import { app } from 'electron'
import path from 'node:path'
import { existsSync } from 'node:fs'
export type WindowsLoginItem = { supported: boolean; enabled: boolean; reason?: string }
// RA: NSIS' uninstaller distinguishes a stable installed copy from win-unpacked/dev artifacts.
export function windowsLoginOptions(input: { platform: NodeJS.Platform; packaged: boolean; installed: boolean; execPath: string; userData: string }): { path: string; args: string[] } | null {
  if (input.platform !== 'win32' || !input.packaged || !input.installed || /[\\/](?:app-[^\\/]+|win-unpacked|\.lanes)[\\/]/i.test(input.execPath)) return null
  return { path: path.win32.resolve(input.execPath), args: ['--js-flags=--max-old-space-size=768', `--user-data-dir=${input.userData}`] }
}
function loginOptions(): { path: string; args: string[] } | null {
  return windowsLoginOptions({ platform: process.platform, packaged: app.isPackaged, installed: process.platform === 'win32' && existsSync(path.join(path.dirname(process.execPath), 'Uninstall Orca.exe')), execPath: process.execPath, userData: app.getPath('userData') })
}
export function readWindowsLoginItem(): WindowsLoginItem {
  const options = loginOptions()
  if (!options) return { supported: false, enabled: false, reason: 'Available in the installed Windows release.' }
  const actual = app.getLoginItemSettings(options)
  return { supported: true, enabled: actual.openAtLogin && actual.executableWillLaunchAtLogin !== false }
}
export function setWindowsLoginItem(enabled: boolean): WindowsLoginItem {
  const options = loginOptions()
  if (!options) throw new Error('Windows login requires a stable installed Orca executable')
  app.setLoginItemSettings({ ...options, openAtLogin: enabled })
  return readWindowsLoginItem()
}
