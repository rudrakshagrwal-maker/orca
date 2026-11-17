import React from 'react'
import { FolderPlus } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { useTranslate } from '@/i18n/use-translate'

import SidebarWorkspaceOptionsMenu from './worktree-list/controls/SidebarWorkspaceOptionsMenu'

function AddProjectButton({
  preserveWorkspaceBoardOpen
}: {
  preserveWorkspaceBoardOpen: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const openModal = useAppStore((s) => s.openModal)
  const label = t('auto.components.sidebar.SidebarHeader.addProject', 'Add project')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          className="text-muted-foreground"
          aria-label={label}
          data-workspace-board-preserve-open={preserveWorkspaceBoardOpen ? '' : undefined}
          onClick={() => openModal('add-repo')}
        >
          <FolderPlus className="size-3.5" strokeWidth={2.25} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

// RA: project admission and list filters remain; the new-workspace composer is deleted.
export function SidebarHeaderActions(): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-1" data-sidebar-header-actions="">
      <SidebarWorkspaceOptionsMenu />
      <AddProjectButton preserveWorkspaceBoardOpen={false} />
    </div>
  )
}
