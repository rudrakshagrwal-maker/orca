// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import React from 'react'
import { Ellipsis, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import { useTranslate } from '@/i18n/use-translate'

import type { ProjectGroup } from '../../../../../../shared/project-group-types'

import type { ExecutionHostId } from '../../../../../../shared/execution-host'
import { getFolderProjectGroupRefreshHandler } from './project-group-folder-refresh'
import { REPO_HEADER_ACTION_BUTTON_CLASS } from './repo-header-action-button-class'
import {
  handleRepoHeaderActionPointerDown,
  stopRepoHeaderKeyboardToggle,
  stopRepoHeaderMenuEvent
} from './header-event-guards'

export function ProjectGroupHeaderMenu({
  groupId,
  hostId,
  label,
  projectGroup,
  onRefreshProjectGroup,
  onRename,
  onDelete
}: {
  groupId: string
  /** Owner host of the group row, so rename/delete route to the host that holds it. */
  hostId?: ExecutionHostId
  label: string
  projectGroup: ProjectGroup | null
  onRefreshProjectGroup?: (projectGroup: ProjectGroup) => void
  onRename: (groupId: string, currentName: string, hostId?: ExecutionHostId) => void
  onDelete: (groupId: string, groupName: string, hostId?: ExecutionHostId) => void
}): React.JSX.Element {
  const t = useTranslate()
  const onRefresh = getFolderProjectGroupRefreshHandler(projectGroup, onRefreshProjectGroup)
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={REPO_HEADER_ACTION_BUTTON_CLASS}
          data-repo-header-action=""
          aria-label={t(
            'auto.components.sidebar.WorktreeList.79465e9034',
            'Group actions for {{value0}}',
            { value0: label }
          )}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={stopRepoHeaderKeyboardToggle}
          onPointerDown={handleRepoHeaderActionPointerDown}
        >
          <Ellipsis className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        // Why: Radix portals keep React bubbling through the project header; block menu events from arming row drag/collapse.
        onPointerDown={stopRepoHeaderMenuEvent}
        onMouseDown={stopRepoHeaderMenuEvent}
        onPointerUp={stopRepoHeaderMenuEvent}
        onMouseUp={stopRepoHeaderMenuEvent}
        onClick={stopRepoHeaderMenuEvent}
        onKeyDown={stopRepoHeaderMenuEvent}
      >
        {onRefresh ? (
          <DropdownMenuItem onSelect={onRefresh}>
            <RefreshCw className="size-3.5" />
            {t('auto.components.sidebar.WorktreeList.refreshProjectGroup', 'Refresh projects')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => onRename(groupId, label, hostId)}>
          {t('auto.components.sidebar.WorktreeList.4d7b73658c', 'Rename group')}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(groupId, label, hostId)}>
          {t('auto.components.sidebar.WorktreeList.902115cdbe', 'Delete group')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
