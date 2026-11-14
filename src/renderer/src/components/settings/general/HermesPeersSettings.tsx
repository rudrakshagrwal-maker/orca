import { useEffect, useState } from 'react'
import type { GlobalSettings } from '../../../../../shared/global-settings-types'
import { DEFAULT_HERMES_PEERS, HermesPeersSchema } from '../../../../../shared/hermes-peers'
import { SettingsGroup } from '../section-layout/SettingsGroup'
import { matchesSettingsSearch } from '../search/settings-search'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export function HermesPeersSettings({
  settings,
  updateSettings,
  query
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
  query: string
}): React.JSX.Element | null {
  const saved = JSON.stringify(settings.hermesPeers ?? DEFAULT_HERMES_PEERS, null, 2)
  const [draft, setDraft] = useState(saved)
  const [error, setError] = useState('')
  useEffect(() => setDraft(saved), [saved])
  if (
    !matchesSettingsSearch(query, [{ title: 'Hermes peers', keywords: ['bots', 'box', 'SSH'] }])
  ) {
    return null
  }
  return (
    <SettingsGroup title="Hermes peers">
      <p className="text-settings-detail text-muted-foreground">
        SSH hosts shown in Bots. Store key paths only. Use [] to disable peers.
      </p>
      <Textarea
        aria-label="Hermes peers"
        value={draft}
        aria-invalid={Boolean(error)}
        variant="code"
        className="min-h-40"
        onChange={(event) => setDraft(event.target.value)}
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button
        size="sm"
        disabled={draft === saved}
        onClick={() => {
          try {
            const peers = HermesPeersSchema.parse(JSON.parse(draft))
            updateSettings({ hermesPeers: peers })
            setError('')
          } catch {
            setError('Enter a valid peer list with unique names and all seven fields.')
          }
        }}
      >
        Save peers
      </Button>
    </SettingsGroup>
  )
}
