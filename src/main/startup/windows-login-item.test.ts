// RA: Reject dev/versioned startup entries and preserve the fork profile and RAM ceiling.
import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: {} }))
import { windowsLoginOptions } from './windows-login-item'
const installed = { platform: 'win32' as const, packaged: true, installed: true, execPath: 'C:\\Users\\RA\\AppData\\Local\\Programs\\Orca-RA\\Orca.exe', userData: 'C:\\Users\\RA\\AppData\\Roaming\\Orca-RA' }
describe('Windows login registration', () => {
  it('uses the installed fork and retains its profile and heap cap', () => {
    expect(windowsLoginOptions(installed)).toEqual({ path: 'C:\\Users\\RA\\AppData\\Local\\Programs\\Orca-RA\\Orca.exe', args: ['--js-flags=--max-old-space-size=768', '--user-data-dir=C:\\Users\\RA\\AppData\\Roaming\\Orca-RA'] })
  })
  it('refuses development, unpacked, versioned and non-Windows executables', () => {
    expect(windowsLoginOptions({ ...installed, packaged: false })).toBeNull()
    expect(windowsLoginOptions({ ...installed, installed: false })).toBeNull()
    expect(windowsLoginOptions({ ...installed, execPath: 'C:\\build\\win-unpacked\\Orca.exe' })).toBeNull()
    expect(windowsLoginOptions({ ...installed, execPath: 'C:\\Orca\\app-1.2.3\\Orca.exe' })).toBeNull()
    expect(windowsLoginOptions({ ...installed, platform: 'linux' })).toBeNull()
  })
})
