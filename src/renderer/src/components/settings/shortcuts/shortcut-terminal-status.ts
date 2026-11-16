import {
  isKeybindingAllowedInTerminal,
  getKeybindingsForContext
} from '../../../../../shared/keybindings/effective'
import type {
  KeybindingDefinition,
  TerminalShortcutPolicy
} from '../../../../../shared/keybindings/types'
import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import { formatKeybindingList } from '../../../../../shared/keybindings/formatting'

export type ShortcutTerminalStatus = {
  label: string
  description: string
}

export function getShortcutTerminalStatus(
  definition: KeybindingDefinition,
  terminalShortcutPolicy: TerminalShortcutPolicy,
  bindings: readonly string[],
  platform: NodeJS.Platform,
  t: Translate = translate
): ShortcutTerminalStatus | undefined {
  if (bindings.length === 0) {
    return undefined
  }
  const terminalBindings = getKeybindingsForContext(definition, bindings, platform, {
    context: 'terminal',
    terminalShortcutPolicy
  })
  if (terminalBindings.join(',') !== bindings.join(',')) {
    return terminalBindings.length > 0
      ? {
          label: t('settings.shortcuts.terminalKeys', 'Terminal keys'),
          description: t('settings.shortcuts.terminalBindings', 'In terminal panes: {{bindings}}', {
            bindings: formatKeybindingList(terminalBindings, platform)
          })
        }
      : {
          label: t('auto.components.settings.ShortcutsPane.5c65d5db9d', 'Terminal first'),
          description: t(
            'auto.components.settings.ShortcutsPane.f0b35b0b2e',
            'Disabled while a terminal or TUI has keyboard focus.'
          )
        }
  }
  if (definition.scope === 'terminal' && isKeybindingAllowedInTerminal(definition)) {
    return {
      label: t('auto.components.settings.ShortcutsPane.cb02e00202', 'Terminal'),
      description: t(
        'auto.components.settings.ShortcutsPane.781cb74d22',
        'Runs from terminal panes.'
      )
    }
  }
  if (isKeybindingAllowedInTerminal(definition)) {
    return {
      label: t('auto.components.settings.ShortcutsPane.25b0004fbf', 'Terminal active'),
      description: t(
        'auto.components.settings.ShortcutsPane.3c0fac059a',
        'Still runs while a terminal has keyboard focus.'
      )
    }
  }
  const activeInTerminal = terminalBindings.length > 0
  return activeInTerminal
    ? {
        label: t('auto.components.settings.ShortcutsPane.25b0004fbf', 'Terminal active'),
        description: t(
          'auto.components.settings.ShortcutsPane.dfa8ff612f',
          'Also runs while a terminal or TUI has keyboard focus.'
        )
      }
    : {
        label: t('auto.components.settings.ShortcutsPane.5c65d5db9d', 'Terminal first'),
        description: t(
          'auto.components.settings.ShortcutsPane.f0b35b0b2e',
          'Disabled while a terminal or TUI has keyboard focus.'
        )
      }
}
