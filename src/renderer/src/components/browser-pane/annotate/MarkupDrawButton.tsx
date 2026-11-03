import React from 'react'
import { PenTool } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

export type MarkupDrawButtonProps = {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  /** Explicitly gate on pane activity: a hidden trigger anchors portaled content at the viewport origin. */
  surfaceActive: boolean
  className?: string
}

export function MarkupDrawButton({
  onClick,
  disabled,
  active,
  className
}: MarkupDrawButtonProps): React.JSX.Element {
  const label = translate('auto.components.browser-pane.markup.drawButton', 'Draw on screenshot')
  // RA: no automatic drawing hint, highlight or New badge.
  const button = (
    <Button
      size="icon"
      variant={active ? 'default' : 'ghost'}
      className={cn(
        className ?? 'h-8 w-8',
        active && 'bg-foreground/80 text-background hover:bg-foreground/90'
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
    >
      <PenTool className="size-4" />
    </Button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
