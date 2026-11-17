// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import { useAppStore } from '@/store'

import { GeneralPane } from '../general/GeneralPane'

import { SettingsSection } from '../section-layout/SettingsSection'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import type { SettingsRenderContext } from './settings-render-context'

export function renderGeneralSettingsSection(
  context: SettingsRenderContext,
  t: Translate = translate
): React.JSX.Element {
  const { model, interactions, navigation, terminal, view } = context
  return (
    <SettingsSection
      id="general"
      grouped
      hideHeader
      title={t('auto.components.settings.Settings.7807c11c4d', 'General')}
      description={t(
        'auto.components.settings.Settings.f9b77539fd',
        'Workspace defaults, app setup, and maintenance.'
      )}
      searchEntries={navigation.getSectionSearchEntries('general')}
    >
      {view.isSectionMounted('general') ? (
        <GeneralPane
          subPage={model.generalSubPage}
          onSelectSubPage={(page, sectionId) => {
            if (sectionId) {
              useAppStore
                .getState()
                .openSettingsTarget({ pane: 'general', repoId: null, sectionId })
              return
            }
            model.setGeneralSubPage(page)
            model.setHighlightedSettingsTarget(null)
            model.setSettingsSearchQuery('')
            interactions.contentScrollRef.current?.scrollTo({ top: 0 })
          }}
          settings={model.settings}
          updateSettings={model.updateSettings}
          updateSettingsOrThrow={model.updateSettingsOrThrow}
          fontSuggestions={model.terminalFontSuggestions}
          onRequestFontSuggestions={interactions.requestFontSuggestions}
          wslSupportedPlatform={terminal.localWslSupportedPlatform}
          wslAvailable={terminal.localWindowsRuntimeCapabilities.wslAvailable}
          wslDistros={terminal.localWindowsRuntimeCapabilities.wslDistros}
          wslCapabilitiesLoading={terminal.localWindowsRuntimeCapabilities.isLoading}
        />
      ) : null}
    </SettingsSection>
  )
}
