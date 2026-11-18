import { translate } from '@/i18n/i18n'
import type { AgentCatalogEntry } from './agent-catalog'

// RA: no unsupported integrations are constructed by any picker.
export function primaryAgentCatalogEntries(): AgentCatalogEntry[] {
  return [
    {
      id: 'claude',
      label: translate('auto.lib.agent.catalog.0708ed89f1', 'Claude Code'),
      cmd: 'claude',
      homepageUrl: 'https://code.claude.com/docs'
    },
    {
      id: 'codex',
      label: translate('auto.lib.agent.catalog.760bc6883d', 'Codex'),
      cmd: 'codex',
      homepageUrl: 'https://github.com/openai/codex'
    },
    {
      id: 'hermes',
      label: translate('auto.lib.agent.catalog.8a9ba743cc', 'Hermes'),
      cmd: 'hermes',
      homepageUrl: 'https://hermes-agent.nousresearch.com/docs/'
    },
    {
      id: 'dsh',
      label: translate('auto.lib.agent.catalog.dsh_label', 'DeepSeek Harness'),
      cmd: 'dsh',
      searchAliases: ['deepseek', 'dsh', 'deepseek harness'],
      homepageUrl: 'https://github.com/deepseek-ai/deepseek-harness'
    }
  ]
}
