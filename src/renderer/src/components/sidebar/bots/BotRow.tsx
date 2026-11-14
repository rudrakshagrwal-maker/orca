import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatShortTimeAgo } from '@/lib/time-format/short-time-ago'
import { cn } from '@/lib/class-names'
import type { BotProfile } from '../../../../../shared/bot-profile-types'

const avatarColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)'
]

export function BotRow({
  profile,
  now,
  onOpen
}: {
  profile: BotProfile
  now: number
  onOpen: (profile: BotProfile, sessionId?: string | null) => Promise<void>
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chats = profile.chats ?? []
  const latest = chats[0]
  const nameHash = Array.from(profile.label).reduce(
    (hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0,
    0
  )
  const open = async (sessionId?: string | null) => {
    if (busy) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onOpen(profile, sessionId)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not open chat.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="flex items-center gap-0.5 rounded-md hover:bg-sidebar-accent">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0"
            aria-label={`Recent chats with ${profile.label}`}
          >
            <ChevronRight className={cn('size-3.5', expanded && 'rotate-90')} aria-hidden />
          </Button>
        </CollapsibleTrigger>
        <button
          type="button"
          disabled={busy}
          onClick={() => void open()}
          aria-label={`Open ${profile.label}`}
          className="flex min-w-0 flex-1 cursor-pointer items-center justify-start gap-2 rounded-md px-1 py-2 text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50"
        >
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs text-sidebar-foreground"
            style={{
              backgroundColor: `color-mix(in srgb, ${avatarColors[nameHash % avatarColors.length]} 35%, var(--sidebar))`
            }}
          >
            {profile.label.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{profile.label}</span>
              {latest && (
                <time
                  className="shrink-0 text-2xs font-normal text-muted-foreground"
                  dateTime={new Date(latest.updatedAt).toISOString()}
                >
                  {formatShortTimeAgo(latest.updatedAt, now)}
                </time>
              )}
            </span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {profile.error
                ? 'Chats unavailable'
                : latest
                  ? latest.preview || latest.title
                  : 'Start a new chat'}
            </span>
          </span>
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={busy}
              onClick={() => void open(null)}
              aria-label={`New chat with ${profile.label}`}
            >
              <Plus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            New chat
          </TooltipContent>
        </Tooltip>
      </div>
      <CollapsibleContent>
        <div className="pl-8">
          {chats.map((chat) => (
            <button
              type="button"
              key={chat.id}
              disabled={busy}
              onClick={() => void open(chat.id)}
              className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="min-w-0 truncate text-xs font-normal">{chat.title}</span>
              <time
                className="shrink-0 text-2xs font-normal text-muted-foreground"
                dateTime={new Date(chat.updatedAt).toISOString()}
              >
                {formatShortTimeAgo(chat.updatedAt, now)}
              </time>
            </button>
          ))}
          {!chats.length && (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              {profile.error || 'No recent chats. Start one with +.'}
            </p>
          )}
        </div>
      </CollapsibleContent>
      {(error || profile.error) && (
        <p role="alert" className="px-2 pb-1 text-xs text-destructive">
          {error || profile.error}
        </p>
      )}
    </Collapsible>
  )
}
