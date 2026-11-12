// RA: Reattach warm PTYs; a cold SSH terminal needs an explicit Reconnect, never gateway-based guessing.
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { openBotTerminal } from '@/lib/bots/open-bot-terminal'
import type { BotTerminalIdentity } from '../../../../shared/bot-profile-types'

export function BotTerminalRestoreGate({ tabId, worktreeId, children }: { tabId: string; worktreeId: string; children: React.ReactNode }): React.JSX.Element {
  const tab = useAppStore((state) => state.tabsByWorktree[worktreeId]?.find((row) => row.id === tabId))
  const pending = useAppStore((state) => Boolean(state.pendingStartupByTabId[tabId]))
  const [admitted, setAdmitted] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const identity: BotTerminalIdentity | undefined = tab?.botProfile
  useEffect(() => {
    if (!identity || pending || !tab?.restoredFromSession) { setAdmitted(true); setChecking(false); return }
    let active = true
    const ptyId = tab.ptyId
    if (!ptyId || !window.api.pty.getGoneSessionIds) { setChecking(false); return }
    void window.api.pty.getGoneSessionIds([ptyId]).then((gone) => {
      if (active) { setAdmitted(!gone.includes(ptyId)); setChecking(false) }
    }).catch(() => { if (active) { setChecking(false); setError('Could not verify the saved SSH terminal.') } })
    return () => { active = false }
  }, [identity, pending, tab?.ptyId, tab?.restoredFromSession])
  if (!identity || admitted) return <>{children}</>
  return <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm">
    <p>{checking ? 'Checking saved terminal…' : `${identity.source === 'hermes' ? 'Hermes' : 'DSH'} / ${identity.id}: Reconnect required`}</p>
    {!checking && <Button variant="outline" disabled={busy} onClick={() => {
      if (!window.api.bots || busy) return
      setBusy(true); setError(null)
      void window.api.bots.list().then(async (snapshot) => {
        const profile = snapshot.profiles.find((row) => row.key === identity.key)
        if (!profile) throw new Error('Profile unavailable. Expand Bots and refresh before reconnecting.')
        // A new tab avoids typing into a restored pane whose process may be unverifiable.
        await openBotTerminal(profile)
      }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Reconnect failed')).finally(() => setBusy(false))
    }}>Reconnect in new tab</Button>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>
}
