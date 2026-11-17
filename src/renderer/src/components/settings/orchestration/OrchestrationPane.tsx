import { ArrowRightLeft, GitBranch, ListChecks, Workflow, type LucideIcon } from 'lucide-react'
import { ORCHESTRATION_SKILL_NAME } from '@/lib/skills/installation/agent-feature-skill-names'
import type { SkillUsageExample } from '@/lib/skills/examples/skill-usage-example'
import { getOrchestrationUsageExamples } from '@/components/orchestration/setup/orchestration-usage-examples'
import { SearchableSetting } from '../section-layout/SearchableSetting'
import { matchesSettingsSearch } from '../search/settings-search'
import { useAppStore } from '../../../store/index'
import { getOrchestrationPaneSearchEntries } from './orchestration-search'
import { SkillUsageExamplesSection } from '../../skills/examples/SkillUsageExamplesSection'
import { useTranslate } from '@/i18n/use-translate'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import { resolveNestedWorkerMaxDepth } from '../../../../../shared/orchestration/workers/nested-worker-depth'
import { isPairedWebClientWindow } from '@/app-shell/chrome/desktop-window-chrome'
import { NumberField } from '../form-controls/SettingsFormControls'
import {
  getNestedWorkerDepthDescription,
  getNestedWorkerDepthTitle
} from './nested-worker-depth-copy'
import { OrchestrationWorkerAutoReleaseSetting } from './OrchestrationWorkerAutoReleaseSetting'
import { SettingsGroup } from '../section-layout/SettingsGroup'

const EXAMPLE_ICONS = {
  handoff: ArrowRightLeft,
  'worktree-handoff': ArrowRightLeft,
  'child-sequence': ListChecks,
  'child-parallel': GitBranch,
  'child-worktrees': Workflow
} as const

function resolveOrchestrationExampleIcon(example: SkillUsageExample): LucideIcon {
  return EXAMPLE_ICONS[example.id as keyof typeof EXAMPLE_ICONS] ?? Workflow
}

type OrchestrationPaneProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
}

export function OrchestrationPane({
  settings,
  updateSettings
}: OrchestrationPaneProps): React.JSX.Element {
  const t = useTranslate()
  const searchQuery = useAppStore((s) => s.settingsSearchQuery)
  const showLocalRuntimeSettings = !isPairedWebClientWindow()
  const searchEntries = getOrchestrationPaneSearchEntries({
    includeLocalRuntimeSettings: showLocalRuntimeSettings
  })
  const showOrchestration = matchesSettingsSearch(searchQuery, searchEntries)

  if (!showOrchestration) {
    return <div />
  }

  return (
    <SearchableSetting
      title={t('auto.components.settings.OrchestrationPane.8a94078d05', 'Agent orchestration')}
      description={t(
        'auto.components.settings.OrchestrationPane.2aacdb0517',
        'Coordinate coding agents across handoffs, worktree handovers, and child-agent work.'
      )}
      keywords={searchEntries[0].keywords}
      forceVisible
      className="space-y-8"
    >
      <SettingsGroup>
        {showLocalRuntimeSettings ? (
          <NumberField
            label={getNestedWorkerDepthTitle(t)}
            description={getNestedWorkerDepthDescription(t)}
            value={resolveNestedWorkerMaxDepth(settings)}
            min={1}
            integer
            onChange={(nestedWorkerMaxDepth) => {
              void updateSettings({ nestedWorkerMaxDepth })
            }}
          />
        ) : null}
        {showLocalRuntimeSettings ? (
          <OrchestrationWorkerAutoReleaseSetting
            settings={settings}
            updateSettings={updateSettings}
          />
        ) : null}
      </SettingsGroup>

      <SkillUsageExamplesSection
        heading={t('auto.components.settings.OrchestrationPane.ae79504732', 'How to use it')}
        description={t(
          'auto.components.settings.OrchestrationPane.52e0634e2c',
          'Ask a coordinator agent to use orchestration for handoffs, worktree handovers, and sequential or parallel child agents.'
        )}
        examples={getOrchestrationUsageExamples()}
        resolveIcon={resolveOrchestrationExampleIcon}
        slashCommand={`/${ORCHESTRATION_SKILL_NAME}`}
      />
    </SearchableSetting>
  )
}
