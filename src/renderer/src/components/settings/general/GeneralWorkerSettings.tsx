// RA: Keep local startup and worker controls searchable without loading other settings pages.
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import { SettingsGroup } from '../section-layout/SettingsGroup'
import { SettingsSwitchRow } from '../form-controls/SettingsFormControls'
import { matchesSettingsSearch } from '../search/settings-search'
import { WindowsLoginSetting } from './WindowsLoginSetting'

export function GeneralWorkerSettings({
  settings,
  updateSettings,
  query
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
  query: string
}): React.JSX.Element | null {
  // RA: worker settings have no memory admission control.
  if (
    !matchesSettingsSearch(query, [
      {
        title: 'Windows login and workers',
        keywords: [
          'startup',
          'start',
          'Orca',
          'login',
          'worker',
          'tabs',
          'hidden',
          'shown',
          'fresh',
          'launch',
          'restore',
          'Claude'
        ]
      }
    ])
  ) {
    return null
  }
  return (
    <SettingsGroup title="Windows login and workers">
      <WindowsLoginSetting />
      <SettingsSwitchRow
        label="Fresh start on launch"
        description="Close previous sessions and open one Claude tab when Orca starts."
        checked={settings.freshStartOnLaunch !== false}
        onChange={() =>
          updateSettings({ freshStartOnLaunch: settings.freshStartOnLaunch === false })
        }
      />
      <SettingsSwitchRow
        label="Show worker tabs"
        description="Hidden by default. Click a worker in Projects to open its terminal."
        checked={settings.workerTabsShown === true}
        onChange={() => updateSettings({ workerTabsShown: settings.workerTabsShown !== true })}
      />
    </SettingsGroup>
  )
}
