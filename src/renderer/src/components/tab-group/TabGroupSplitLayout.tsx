import type { TabGroupLayoutNode } from '../../../../shared/tab-types'
import { TabGroupSplitNodeTree } from './TabGroupSplitNodeTree'
import { WorkspaceTabDragLayer } from './WorkspaceTabDragLayer'

/** Compose main-window chrome around the shared drag scope/tree; other hosts supply their own chrome. */
export default function TabGroupSplitLayout({
  layout,
  worktreeId,
  focusedGroupId,
  isWorktreeActive
}: {
  layout: TabGroupLayoutNode
  worktreeId: string
  focusedGroupId?: string
  isWorktreeActive: boolean
}): React.JSX.Element {
  return (
    <WorkspaceTabDragLayer worktreeId={worktreeId} enabled={isWorktreeActive}>
      {({ isTabDragActive, hoveredTabInsertion, setDragRootNode }) => (
        /* RA: Panel borders replace the shared sidebar seam in the main workspace. */
        <div
          ref={setDragRootNode}
          className="workspace-tab-layout flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden"
        >
          <div
            className="workspace-tab-drag-strip h-[4px] shrink-0 bg-tab-bar"
            data-terminal-focus-release-surface="true"
          />
          <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
            <TabGroupSplitNodeTree
              layout={layout}
              worktreeId={worktreeId}
              focusedGroupId={focusedGroupId}
              isWorktreeActive={isWorktreeActive}
              isTabDragActive={isTabDragActive}
              hoveredTabInsertion={hoveredTabInsertion}
            />
          </div>
        </div>
      )}
    </WorkspaceTabDragLayer>
  )
}
