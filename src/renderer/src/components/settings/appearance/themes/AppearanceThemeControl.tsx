import type React from 'react'
import type { GlobalSettings } from '../../../../../../shared/global-settings-types'
import {
  editorThemeSlotUpdate,
  MATCH_TERMINAL_APP_THEME,
  pluginAppThemeSlotUpdate
} from '../../../../../../shared/plugin-theme-settings'
import { SettingsSegmentedControl } from '../../form-controls/SettingsFormControls'
import { useTranslate } from '@/i18n/use-translate'

// RA: appearance controls use built-in choices without plugin catalogs or installation.
export function AppearanceThemeControl({
  label,
  settings,
  updateSettings,
  applyTheme
}: {
  label: string
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
  applyTheme: (theme: GlobalSettings['theme']) => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <SettingsSegmentedControl
      ariaLabel={label}
      value={settings.theme}
      onChange={(theme) => {
        updateSettings({ theme })
        applyTheme(theme)
      }}
      options={[
        {
          value: 'system',
          label: t('auto.components.settings.AppearancePane.fb0e0b4453', 'System')
        },
        { value: 'dark', label: t('auto.components.settings.AppearancePane.7d26ccabe8', 'Dark') },
        { value: 'light', label: t('auto.components.settings.AppearancePane.fd89b5487c', 'Light') }
      ]}
    />
  )
}

type ThemeSlotProps = {
  base: 'light' | 'dark'
  label: string
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function AppearanceThemeSlotSelect({
  base,
  label,
  settings,
  updateSettings
}: ThemeSlotProps): React.JSX.Element {
  const t = useTranslate()
  const selected = base === 'dark' ? settings.pluginAppThemeDark : settings.pluginAppThemeLight
  return (
    <SettingsSegmentedControl
      ariaLabel={label}
      value={selected === MATCH_TERMINAL_APP_THEME ? 'terminal' : 'built-in'}
      onChange={(value) =>
        updateSettings(
          pluginAppThemeSlotUpdate(base, value === 'terminal' ? MATCH_TERMINAL_APP_THEME : null)
        )
      }
      options={[
        {
          value: 'built-in',
          label: t(
            'auto.components.settings.AppearanceInterfaceSection.pluginIconTheme.builtIn',
            'Built-in'
          )
        },
        {
          value: 'terminal',
          label: t('auto.components.settings.AppearanceThemeControl.7ad388ec82', 'Match terminal')
        }
      ]}
    />
  )
}

export function CodeEditorThemeSelect({
  base,
  label,
  settings,
  updateSettings
}: ThemeSlotProps): React.JSX.Element {
  const t = useTranslate()
  const selected = base === 'dark' ? settings.editorThemeDark : settings.editorThemeLight
  return (
    <SettingsSegmentedControl
      ariaLabel={label}
      value={selected === 'light' || selected === 'dark' ? selected : 'follow-app'}
      onChange={(value) =>
        updateSettings(
          editorThemeSlotUpdate(base, value === 'light' || value === 'dark' ? value : null)
        )
      }
      options={[
        {
          value: 'follow-app',
          label: t('settings.appearance.editorTheme.followApp', 'Same as app theme')
        },
        { value: 'light', label: t('auto.components.settings.AppearancePane.fd89b5487c', 'Light') },
        { value: 'dark', label: t('auto.components.settings.AppearancePane.7d26ccabe8', 'Dark') }
      ]}
    />
  )
}
