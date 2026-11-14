import { useState } from 'react'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/class-names'
import { openBotTerminal } from '@/lib/bots/open-bot-terminal'
import { openBotChat } from '@/lib/bots/open-bot-chat'
import { BotRow } from './BotRow'
import { useBotProfiles } from './use-bot-profiles'

export function BotsSection(): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(true)
  const { snapshot, busy, refresh } = useBotProfiles(expanded)
  const now = useNow(60_000, expanded)
  if (!window.api?.bots) {
    return null
  }
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} asChild>
      <section className="shrink-0 border-t border-sidebar-border px-1 py-1 text-sidebar-foreground">
        <div className="flex items-center">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex h-7 min-w-0 flex-1 cursor-pointer items-center justify-start gap-1 rounded-md px-2 text-[13px] font-medium hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <ChevronRight className={cn('size-3.5', expanded && 'rotate-90')} aria-hidden /> Bots
            </button>
          </CollapsibleTrigger>
          {expanded && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={busy}
                  onClick={refresh}
                  aria-label="Refresh bots"
                  className="mr-1"
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                Refresh bots
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <CollapsibleContent>
          <div className="worktree-sidebar-scrollbar max-h-72 overflow-y-auto">
            {[
              { name: 'local', label: 'This laptop', error: snapshot.error },
              ...(snapshot.peers ?? []).map((peer) => ({
                ...peer,
                label: peer.name === 'box' ? 'Box' : peer.name
              }))
            ].map((group) => (
              <div key={group.name}>
                <p className="px-3 pt-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                {snapshot.profiles
                  .filter((profile) => (profile.host ?? 'local') === group.name)
                  .map((profile) => (
                    <BotRow
                      key={profile.key}
                      profile={profile}
                      now={now}
                      onOpen={openBotChat}
                      onTerminal={openBotTerminal}
                    />
                  ))}
                {group.error && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">{group.error}</p>
                )}
              </div>
            ))}
            {!snapshot.profiles.some((profile) => (profile.host ?? 'local') === 'local') && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {busy
                  ? 'Loading bots…'
                  : snapshot.installed === false
                    ? 'Hermes is not installed.'
                    : 'No bots available.'}
              </p>
            )}
            {snapshot.error && (
              <div className="px-3 pb-1">
                <p role="alert" className="text-xs text-destructive">
                  {snapshot.error}
                </p>
                <Button variant="ghost" size="xs" disabled={busy} onClick={refresh}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
