import { defineFixture } from '../../component-fixtures/component-fixture'
import { createEmptyRateLimitState } from '../../../../shared/rate-limit-state-factory'
import { SidebarAgentUsageRows } from './SidebarAgentUsage'

const usage = createEmptyRateLimitState({
  claude: {
    provider: 'claude',
    session: {
      usedPercent: 42,
      windowMinutes: 300,
      resetsAt: Date.UTC(2026, 10, 19, 17),
      resetDescription: null
    },
    weekly: {
      usedPercent: 68,
      windowMinutes: 10080,
      resetsAt: Date.UTC(2026, 10, 23, 8),
      resetDescription: null
    },
    status: 'ok',
    updatedAt: 1,
    error: null
  },
  codex: {
    provider: 'codex',
    session: {
      usedPercent: 12,
      windowMinutes: 300,
      resetsAt: Date.UTC(2026, 10, 19, 18),
      resetDescription: null
    },
    weekly: {
      usedPercent: 83,
      windowMinutes: 10080,
      resetsAt: Date.UTC(2026, 10, 25, 12),
      resetDescription: null
    },
    status: 'ok',
    updatedAt: 1,
    error: null
  }
})

export const compact = defineFixture({
  width: 252,
  render: () => <SidebarAgentUsageRows usage={usage} />
})
