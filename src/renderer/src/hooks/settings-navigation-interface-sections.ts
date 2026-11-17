// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import { getAppearancePaneSearchEntries } from '@/components/settings/appearance/appearance-search'

import { getShortcutsPaneSearchEntries } from '@/components/settings/shortcuts/shortcuts-search'

import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import type { SettingsNavSection } from '@/components/settings/navigation/settings-navigation-types'
import { Keyboard, Palette } from 'lucide-react'
import type { SettingsNavigationBuildOptions } from './settings-navigation-build-options'

export function buildInterfaceSettingsSections(
  {
    isMac,
    isWindows,
    isWebClient,

    managedBrowserCreationEnabled,
    mobileEmulatorCreationEnabled
  }: SettingsNavigationBuildOptions,
  t: Translate = translate
): SettingsNavSection[] {
  const showDesktopOnlySettings = !isWebClient
  return [
    {
      id: 'appearance',
      title: t('auto.hooks.useSettingsNavigationMetadata.93d88d20bf', 'Appearance'),
      description: t(
        'auto.hooks.useSettingsNavigationMetadata.b11a5a48a2',
        'Theme, zoom, app and terminal appearance, sidebars, and status bar.'
      ),
      icon: Palette,
      searchEntries: getAppearancePaneSearchEntries({
        showDesktopThemeImports: showDesktopOnlySettings,
        showSystemTray: showDesktopOnlySettings && isWindows,
        showMenuBarIcon: showDesktopOnlySettings && isMac
      }),
      group: 'interface'
    },

    ...(showDesktopOnlySettings ? [] : []),
    {
      id: 'shortcuts',
      title: t('auto.hooks.useSettingsNavigationMetadata.94295ebfb3', 'Shortcuts'),
      description: t(
        'auto.hooks.useSettingsNavigationMetadata.dcd0d9b74f',
        'Keyboard shortcuts for common actions.'
      ),
      icon: Keyboard,
      searchEntries: getShortcutsPaneSearchEntries({
        includeManagedBrowser: managedBrowserCreationEnabled,
        includeMobileEmulator: mobileEmulatorCreationEnabled
      }),
      group: 'interface'
    }
  ]
}
