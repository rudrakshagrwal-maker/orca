// RA: Bounded list leaves the existing Projects scroll area in control.
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openBotTerminal } from '@/lib/bots/open-bot-terminal'
import { useBotProfiles } from './use-bot-profiles'

export function BotsSection(): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { snapshot, busy, refresh } = useBotProfiles(expanded)
  if (!window.api.bots) return null
  return <section className="shrink-0 border-t border-sidebar-border px-2 py-1">
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />} Bots
      </Button>
      {expanded && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void refresh()}>{busy ? 'Refreshing' : 'Refresh'}</Button>}
    </div>
    {expanded && <div className="max-h-48 overflow-y-auto worktree-sidebar-scrollbar">
      {snapshot.profiles.map((profile) => <button key={profile.key} className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-sidebar-accent" onClick={() => { setError(null); void openBotTerminal(profile).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Bot launch failed')) }}>
        <span className="block">{profile.label}</span>
        <span className="block truncate text-xs text-muted-foreground" title={profile.home}>{profile.application} · {profile.source === 'dsh' ? profile.home : 'SSH, /home/hermes'}</span>
      </button>)}
      {!snapshot.profiles.length && !busy && <p className="px-2 text-xs text-muted-foreground">No profiles discovered.</p>}
      {(error || snapshot.error) && <p role="alert" className="px-2 text-xs text-destructive">{error || snapshot.error}</p>}
    </div>}
  </section>
}
