// RA: Remove unused surfaces and their startup dependencies from the lean fork.

import { getAgentsPaneSearchEntries } from '@/components/settings/agents/agents-search'

import { getGeneralPaneSearchEntries } from '@/components/settings/general/general-search'

import { getOrchestrationPaneSearchEntries } from '@/components/settings/orchestration/orchestration-search'

import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import type { SettingsNavSection } from '@/components/settings/navigation/settings-navigation-types'
import { Bot, Network, SlidersHorizontal } from 'lucide-react'
import type { SettingsNavigationBuildOptions } from './settings-navigation-build-options'

export function buildCapabilitySettingsSections(
  { isLocalWindowsHost, isWebClient, isLinearConnected }: SettingsNavigationBuildOptions,
  t: Translate = translate
): SettingsNavSection[] {
  const showDesktopOnlySettings = !isWebClient
  return [
    {
      id: 'agents',
      title: t('auto.hooks.useSettingsNavigationMetadata.b49abbd2f7', 'Agents'),
      description: t(
        'auto.hooks.useSettingsNavigationMetadata.4121f7a0a2',
        'Manage AI agents, set a default, and customize commands.'
      ),
      icon: Bot,
      searchEntries: getAgentsPaneSearchEntries({
        includeAgentAwake: !isWebClient,
        includeAgentChatChoice: !isWebClient,
        includeAgentRuntime: isLocalWindowsHost,
        includeAgentWorkspaceTrust: !isWebClient,
        includeCodexTerminalServerIsolation: !isWebClient
      }),
      group: 'capabilities'
    },

    {
      id: 'orchestration',
      title: t('auto.hooks.useSettingsNavigationMetadata.58a868e8e4', 'Orchestration'),
      description: t(
        'auto.hooks.useSettingsNavigationMetadata.cd50cec5d7',
        'Coordinate multiple coding agents through Orca.'
      ),
      icon: Network,
      searchEntries: getOrchestrationPaneSearchEntries({
        includeLocalRuntimeSettings: !isWebClient
      }),
      group: 'capabilities'
    },
    // Expose only with connected Linear; its skill needs linked provider capability.
    ...(isLinearConnected ? [] : []),
    ...(showDesktopOnlySettings ? [] : [])
  ]
}

export function buildSetupSettingsSections(
  { isLocalWindowsHost, isWebClient }: SettingsNavigationBuildOptions,
  t: Translate = translate
): SettingsNavSection[] {
  const showDesktopOnlySettings = !isWebClient
  return [
    ...(showDesktopOnlySettings ? [] : []),

    {
      id: 'general',
      title: t('auto.hooks.useSettingsNavigationMetadata.13241992bd', 'General'),
      description: t(
        'auto.hooks.useSettingsNavigationMetadata.2cd4ea75da',
        'Workspace defaults, app setup, and maintenance.'
      ),
      icon: SlidersHorizontal,
      searchEntries: getGeneralPaneSearchEntries({ includeProjectRuntime: isLocalWindowsHost }),
      group: 'setup'
    },

    ...(showDesktopOnlySettings ? [] : [])
  ]
}
