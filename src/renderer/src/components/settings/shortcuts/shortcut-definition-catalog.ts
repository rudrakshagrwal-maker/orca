import {
  findKeybindingConflictsForDefinitions,
  formatKeybindingList
} from '../../../../../shared/keybindings/formatting'
import type {
  KeybindingActionId,
  KeybindingDefinition,
  KeybindingOverrides
} from '../../../../../shared/keybindings/types'
import {
  findMacSystemHotkeyConflicts,
  type MacCapturedDigitChord
} from '../../../../../shared/macos-symbolic-hotkeys'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'

import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'
import { disabledAgentTabActionIds, groupDefinitions, type ShortcutGroup } from './shortcut-groups'

export type ShortcutDefinitionCatalog = {
  groups: ShortcutGroup[]
  definitions: KeybindingDefinition[]
  definitionsByAction: Map<KeybindingActionId, KeybindingDefinition>
  ignoredConflictActionIds: KeybindingActionId[]
  conflictByAction: Map<KeybindingActionId, string[]>
}

export function buildShortcutDefinitionCatalog(
  options: {
    disabledTuiAgents: readonly TuiAgent[]
    keybindings: KeybindingOverrides
    platform: NodeJS.Platform
    macCapturedDigitChords?: readonly MacCapturedDigitChord[]
    missionControlConflictMessage: string
  },
  t: Translate = translate
): ShortcutDefinitionCatalog {
  // RA: plugin keybindings are removed with the plugin runtime.
  const groups = groupDefinitions(options.disabledTuiAgents)
  const definitions = groups.flatMap((group) => group.items)
  const definitionsByAction = new Map(definitions.map((definition) => [definition.id, definition]))
  const ignoredConflictActionIds = disabledAgentTabActionIds(options.disabledTuiAgents)
  const conflictByAction = new Map<KeybindingActionId, string[]>()
  const conflicts = findKeybindingConflictsForDefinitions(
    definitions,
    options.platform,
    options.keybindings,
    {
      ignoredActionIds: ignoredConflictActionIds,
      // Warn when main intercepts a custom chord before the renderer receives it.
      includeMainProcessInterception: true
    }
  )
  for (const conflict of conflicts) {
    const labels = conflict.actionIds
      .map((id) => definitionsByAction.get(id)?.title ?? id)
      .join(', ')
    for (const actionId of conflict.actionIds) {
      conflictByAction.set(actionId, [
        ...(conflictByAction.get(actionId) ?? []),
        t(
          'auto.components.settings.shortcutDefinitionCatalog.bindingConflict',
          '{{binding}} conflicts with {{actions}}.',
          {
            binding: formatKeybindingList([conflict.binding], options.platform),
            actions: labels
          }
        )
      ])
    }
  }
  const systemConflicts = findMacSystemHotkeyConflicts(
    definitions,
    options.platform,
    options.keybindings,
    options.macCapturedDigitChords ?? []
  )
  for (const conflict of systemConflicts) {
    if (ignoredConflictActionIds.includes(conflict.actionId)) {
      continue
    }
    conflictByAction.set(conflict.actionId, [
      ...(conflictByAction.get(conflict.actionId) ?? []),
      options.missionControlConflictMessage
    ])
  }
  return {
    groups,
    definitions,
    definitionsByAction,
    ignoredConflictActionIds,
    conflictByAction
  }
}
