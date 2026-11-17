import { getUiLanguageChoiceLabel, UI_LANGUAGE_CHOICES } from '@/i18n/supported-languages'
import { translate } from '@/i18n/i18n'

// RA: language choices use bundled packs only.
export function useUiLanguagePickerLabels() {
  return {
    choices: UI_LANGUAGE_CHOICES.map((choice) => getUiLanguageChoiceLabel(choice, translate))
  }
}
