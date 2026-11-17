import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { AppState } from '../../store/types'

export function toggleAgentDashboardFromShortcut(
  _state: Pick<
    AppState,
    'activeView' | 'agentDashboardDrawerOpen' | 'setSidebarOpen' | 'setAgentDashboardDrawerOpen'
  > & {
    settings: Pick<
      GlobalSettings,
      'experimentalAgentDashboardPopout' | 'experimentalAgentDashboardMode'
    > | null
  },
  _openPopout: () => void
): void {
  // RA: dashboard drawer/popout entry points are retired; Projects keeps the agent tree.
}
