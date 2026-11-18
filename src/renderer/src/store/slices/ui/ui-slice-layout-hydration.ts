import type { PersistedUIState } from '../../../../../shared/persisted-ui-state-types'
import type { UISlice } from './ui-slice-contract'
import type { AppState } from '../../types'
import {
  sanitizePersistedSidebarWidth,
  sanitizeActivityBarPosition
} from './ui-slice-hydration-sanitizers'
import { clampMarkdownTocPanelWidth } from '../../../../../shared/markdown-toc-panel-width'
import { clampCombinedDiffFileTreeWidth } from '../../../../../shared/combined-diff-file-tree-width'
import { normalizeRightSidebarRoute } from '../right-sidebar/right-sidebar-route'

const MAX_LEFT_SIDEBAR_WIDTH = 500
const MAX_RIGHT_SIDEBAR_WIDTH = 4000

export function hydrateUiLayout(ui: PersistedUIState, s: AppState) {
  return {
    // Why: persisted widths may be stale/corrupt/hand-edited; clamp during hydration so invalid values can't break layout.
    sidebarWidth: sanitizePersistedSidebarWidth(
      ui.sidebarWidth,
      s.sidebarWidth,
      MAX_LEFT_SIDEBAR_WIDTH
    ),
    rightSidebarWidth: sanitizePersistedSidebarWidth(
      ui.rightSidebarWidth,
      s.rightSidebarWidth,
      MAX_RIGHT_SIDEBAR_WIDTH
    ),
    markdownTocPanelWidth: clampMarkdownTocPanelWidth(
      ui.markdownTocPanelWidth,
      undefined,
      s.markdownTocPanelWidth
    ),
    combinedDiffFileTreeWidth: clampCombinedDiffFileTreeWidth(
      ui.combinedDiffFileTreeWidth,
      undefined,
      s.combinedDiffFileTreeWidth
    ),
    sidebarOpen: typeof ui.sidebarOpen === 'boolean' ? ui.sidebarOpen : true,
    // RA: viewport bounds are applied by the splitter, including after window resize.
    sidebarAgentsHeight:
      typeof ui.sidebarAgentsHeight === 'number' && Number.isFinite(ui.sidebarAgentsHeight)
        ? Math.max(90, ui.sidebarAgentsHeight)
        : null,
    sidebarView: (ui.sidebarView === 'files' || ui.sidebarView === 'search'
      ? ui.sidebarView
      : 'projects') as UISlice['sidebarView'],
    rightSidebarOpen: typeof ui.rightSidebarOpen === 'boolean' ? ui.rightSidebarOpen : true,
    ...normalizeRightSidebarRoute(ui.rightSidebarTab, ui.rightSidebarExplorerView),
    activityBarPosition: sanitizeActivityBarPosition(ui.activityBarPosition)
  }
}
