// RA: Remove unused surfaces and their startup dependencies from the lean fork.

import { getBrowserPaneCombinedSearchEntries } from '@/components/settings/browser/browser-pane-search'

import { getQuickCommandsPaneSearchEntries } from '@/components/settings/quick-commands/quick-commands-search'

import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import type { SettingsNavSection } from '@/components/settings/navigation/settings-navigation-types'
import { Globe, Play, SquareTerminal } from 'lucide-react'
import type { SettingsNavigationBuildOptions } from './settings-navigation-build-options'

export function buildWorkflowSettingsSections(
  { isWebClient }: SettingsNavigationBuildOptions,
  terminalPaneSearchEntries: SettingsNavSection['searchEntries'],
  t: Translate = translate
): SettingsNavSection[] {
  const showDesktopOnlySettings = !isWebClient
  return [
    {
      id: 'terminal',
      title: t('auto.hooks.useSettingsNavigationMetadata.a9fb10afca', 'Terminal'),
      description: t(
        'auto.hooks.useSettingsNavigationMetadata.c33bfd664c',
        'Shells, renderer, sessions, and terminal behavior.'
      ),
      icon: SquareTerminal,
      searchEntries: terminalPaneSearchEntries,
      group: 'workflows'
    },
    {
      id: 'quick-commands',
      title: t('auto.hooks.useSettingsNavigationMetadata.3fc3db144f', 'Quick Commands'),
      description: t(
        'auto.hooks.useSettingsNavigationMetadata.42ae40842f',
        'Saved terminal commands, scoped globally or per project.'
      ),
      icon: Play,
      searchEntries: getQuickCommandsPaneSearchEntries(),
      group: 'workflows'
    },
    ...(showDesktopOnlySettings
      ? [
          {
            id: 'browser',
            title: t('auto.hooks.useSettingsNavigationMetadata.8c197f74a1', 'Browser'),
            description: t(
              'auto.hooks.useSettingsNavigationMetadata.e815fd01bd',
              'Home page, link routing, and session cookies.'
            ),
            icon: Globe,
            searchEntries: getBrowserPaneCombinedSearchEntries(),
            group: 'workflows'
          }
        ]
      : []),
    ...(showDesktopOnlySettings ? [] : [])
  ]
}
