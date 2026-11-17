// RA: Remove unused surfaces and their startup dependencies from the lean fork.

import { AgentsPane } from '../agents/AgentsPane'
import { AgentDefaultSurfaceSection } from '../agents/surfaces/AgentDefaultSurfaceSection'

import { OrchestrationPane } from '../orchestration/OrchestrationPane'

import { SettingsSection } from '../section-layout/SettingsSection'

import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import type { SettingsRenderContext } from './settings-render-context'

export function renderAgentsSettingsSection(
  context: SettingsRenderContext,
  t: Translate = translate
): React.JSX.Element {
  const { model, navigation, terminal, view } = context
  return (
    <SettingsSection
      id="agents"
      grouped
      title={t('auto.components.settings.Settings.8afa676615', 'Agents')}
      description={t(
        'auto.components.settings.Settings.ec1ba547f7',
        'Manage AI agents, set a default, and customize commands.'
      )}
      searchEntries={navigation.getSectionSearchEntries('agents')}
    >
      {view.isSectionMounted('agents') ? (
        <div className="space-y-8">
          {model.settingsHostScope.target.kind === 'local' ? (
            <AgentDefaultSurfaceSection settings={model.settings} />
          ) : null}
          <AgentsPane
            settings={model.settings}
            updateSettings={model.updateSettings}
            hostScope={model.settingsHostScope}
            wslSupportedPlatform={terminal.localWslSupportedPlatform}
            wslAvailable={terminal.localWindowsRuntimeCapabilities.wslAvailable}
            wslDistros={terminal.localWindowsRuntimeCapabilities.wslDistros}
            wslCapabilitiesLoading={terminal.localWindowsRuntimeCapabilities.isLoading}
          />
        </div>
      ) : null}
    </SettingsSection>
  )
}

export function renderOrchestrationSettingsSection(
  context: SettingsRenderContext,
  t: Translate = translate
): React.JSX.Element {
  const { model, navigation, view } = context
  return (
    <SettingsSection
      id="orchestration"
      grouped
      title={t('auto.components.settings.Settings.00c3a7950d', 'Orchestration')}
      description={t(
        'auto.components.settings.Settings.475980f53d',
        'Coordinate multiple coding agents through Orca.'
      )}
      searchEntries={navigation.getSectionSearchEntries('orchestration')}
    >
      {view.isSectionMounted('orchestration') ? (
        <OrchestrationPane settings={model.settings} updateSettings={model.updateSettings} />
      ) : null}
    </SettingsSection>
  )
}
