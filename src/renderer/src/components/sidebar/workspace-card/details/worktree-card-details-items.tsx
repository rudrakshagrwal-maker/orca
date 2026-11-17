import type React from 'react'
import { MessageSquare } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { WorktreeCardController } from '../controller/use-worktree-card-controller'
// RA: card hovers retain workspace identity and comments without removed feature links.
export function renderWorktreeCardIndicators(
  card: WorktreeCardController
): React.ReactElement | null {
  return card.metaComment ? (
    <MessageSquare className="size-3 text-muted-foreground" aria-hidden />
  ) : null
}
export function WorktreeCardMetaDetailsHover({
  card,
  children
}: {
  card: WorktreeCardController
  children: React.ReactElement
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{card.metaComment}</TooltipContent>
    </Tooltip>
  )
}
export function WorktreeCardIdentityHover({
  card,
  branchName,
  workspaceTitle,
  children
}: {
  card: WorktreeCardController
  branchName: string | undefined
  workspaceTitle: string | undefined
  children: React.ReactElement<React.RefAttributes<HTMLElement>>
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        <div>{workspaceTitle}</div>
        <div>{branchName}</div>
        <div>{card.hoverComment}</div>
      </TooltipContent>
    </Tooltip>
  )
}
