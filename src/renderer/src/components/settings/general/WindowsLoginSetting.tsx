// RA: Read back Windows' actual startup state, including Task Manager disabling it.
import { useEffect, useState } from 'react'
import { SettingsSwitchRow } from '../form-controls/SettingsFormControls'
export function WindowsLoginSetting(): React.JSX.Element | null {
  const [status, setStatus] = useState<{ supported: boolean; enabled: boolean; reason?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    void window.api.app.windowsLoginItem?.().then((value) => { if (active) setStatus(value) }).catch(() => { if (active) setError('Could not read Windows startup settings.') })
    return () => { active = false }
  }, [])
  if (!window.api.platform.get().platform.includes('win32')) return null
  return <>
    <SettingsSwitchRow label="Start Orca at Windows login" description={status?.reason ?? 'Restore the last workspace when you sign in.'} checked={status?.enabled ?? false} disabled={!status?.supported || busy} onChange={() => {
      if (!status || busy) return
      setBusy(true); setError(null)
      void window.api.app.windowsLoginItem?.(!status.enabled).then((actual) => {
        setStatus(actual)
        if (actual.enabled === status.enabled) setError('Windows did not change the setting; check Startup apps in Windows Settings.')
      }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not update startup.')).finally(() => setBusy(false))
    }} />
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </>
}
