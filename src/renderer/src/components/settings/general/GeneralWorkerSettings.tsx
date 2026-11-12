// RA: Keep local startup and worker controls searchable without loading other settings pages.
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import { useEffect, useState } from 'react'
import { SettingsGroup } from '../section-layout/SettingsGroup'
import { SettingsSwitchRow } from '../form-controls/SettingsFormControls'
import { Input } from '@/components/ui/input'
import { matchesSettingsSearch } from '../search/settings-search'
import { WindowsLoginSetting } from './WindowsLoginSetting'

export function GeneralWorkerSettings({ settings, updateSettings, query }: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
  query: string
}): React.JSX.Element | null {
  const [limit, setLimit] = useState(String(settings.workerRamLimitPercent ?? 80))
  useEffect(() => setLimit(String(settings.workerRamLimitPercent ?? 80)), [settings.workerRamLimitPercent])
  if (!matchesSettingsSearch(query, [{ title: 'Windows login and workers', keywords: ['startup', 'start', 'Orca', 'login', 'worker', 'tabs', 'hidden', 'shown', 'RAM', 'memory', 'limit'] }])) return null
  return (
    <SettingsGroup title="Windows login and workers">
      <WindowsLoginSetting />
      <SettingsSwitchRow
        label="Show worker tabs"
        description="Hidden by default. Click a worker in Projects to open its terminal."
        checked={settings.workerTabsShown === true}
        onChange={() => updateSettings({ workerTabsShown: settings.workerTabsShown !== true })}
      />
      <label className="flex items-center justify-between py-2 text-sm">
        Worker RAM limit (%)
        <Input
          aria-label="Worker RAM limit percent"
          type="number"
          min={70}
          max={90}
          className="w-20"
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
          onBlur={() => {
            const parsed = limit.trim() ? Number(limit) : settings.workerRamLimitPercent ?? 80
            const value = Number.isFinite(parsed) ? Math.max(70, Math.min(90, parsed)) : 80
            setLimit(String(value))
            updateSettings({ workerRamLimitPercent: value })
          }}
        />
      </label>
    </SettingsGroup>
  )
}
