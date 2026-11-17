// RA: Remove unused surfaces and their startup dependencies from the lean fork.

import { AppearancePane } from '../appearance/AppearancePane'

import { ShortcutsPane } from '../shortcuts/ShortcutsPane'
import { SettingsSection } from '../section-layout/SettingsSection'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import type { SettingsRenderContext } from './settings-render-context'

export function renderAppearanceSettingsSection(
  context: SettingsRenderContext,
  t: Translate = translate
): React.JSX.Element {
  const { model, interactions, navigation, view } = context
  return (
    <SettingsSection
      id="appearance"
      grouped
      title={t('auto.components.settings.Settings.2b4474780a', 'Appearance')}
      description={t(
        'auto.components.settings.Settings.6d1a27e193',
        'Theme, zoom, app and terminal appearance, sidebars, and status bar.'
      )}
      searchEntries={navigation.getSectionSearchEntries('appearance')}
    >
      {view.isSectionMounted('appearance') ? (
        <AppearancePane
          settings={model.settings}
          updateSettings={model.updateSettings}
          applyTheme={navigation.applyTheme}
          fontSuggestions={model.fontSuggestions}
          terminalFontSuggestions={model.terminalFontSuggestions}
          onRequestFontSuggestions={interactions.requestFontSuggestions}
          systemPrefersDark={model.systemPrefersDark}
          terminalConfigImport={model.terminalConfigImport}
          warpThemes={model.warpThemes}
        />
      ) : null}
    </SettingsSection>
  )
}

export type ChatSettingsRenderContext = {
  model: Pick<
    SettingsRenderContext['model'],
    | 'settings'
    | 'fontSuggestions'
    | 'updateSettings'
    | 'setHasUnsavedChatPromptChanges'
    | 'sourceControlAiPromptDiscardSignal'
    | 'hasUnsavedChatPromptChanges'
    | 'showDesktopOnlySettings'
  >
  interactions: Pick<
    SettingsRenderContext['interactions'],
    'writeSourceControlAiSettingsOrThrow' | 'requestFontSuggestions'
  >
  navigation: Pick<SettingsRenderContext['navigation'], 'getSectionSearchEntries'>
  view: Pick<SettingsRenderContext['view'], 'isSectionMounted'>
}

export function renderShortcutsSettingsSection(
  context: SettingsRenderContext,
  t: Translate = translate
): React.JSX.Element {
  const { navigation, view } = context
  return (
    <SettingsSection
      id="shortcuts"
      title={t('auto.components.settings.Settings.23bf7a1ad4', 'Shortcuts')}
      description={t(
        'auto.components.settings.Settings.a737a4bb22',
        'Keyboard shortcuts for common actions.'
      )}
      searchEntries={navigation.getSectionSearchEntries('shortcuts')}
      className={
        view.isFocusedShortcutsPane ? 'flex min-h-0 flex-1 flex-col space-y-0 gap-6' : undefined
      }
      bodyClassName={view.isFocusedShortcutsPane ? 'min-h-0 flex-1 overflow-hidden' : undefined}
    >
      {view.isSectionMounted('shortcuts') ? <ShortcutsPane /> : null}
    </SettingsSection>
  )
}
