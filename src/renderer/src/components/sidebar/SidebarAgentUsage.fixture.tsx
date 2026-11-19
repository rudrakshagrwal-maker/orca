import { defineFixture } from '../../component-fixtures/component-fixture'
import { SidebarAgentUsageRows } from './SidebarAgentUsage'

export const compact = defineFixture({
  width: 252,
  render: () => (
    <SidebarAgentUsageRows
      providers={['claude', 'codex'].map((provider) => ({
        provider: provider as 'claude' | 'codex',
        status: 'ok',
        updatedAt: 1,
        error: null,
        session: { usedPercent: 24, windowMinutes: 300, resetsAt: null, resetDescription: '15:30' },
        weekly: {
          usedPercent: 61,
          windowMinutes: 10080,
          resetsAt: null,
          resetDescription: 'Fri 15:30'
        }
      }))}
      onOpenProvider={() => {}}
    />
  )
})
