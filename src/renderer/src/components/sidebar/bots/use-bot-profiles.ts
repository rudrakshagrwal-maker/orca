import { useCallback, useEffect, useState } from 'react'
import { installWindowVisibilityInterval } from '@/lib/window-activity/window-visibility-interval'
import type { BotProfileSnapshot } from '../../../../../shared/bot-profile-types'

let saved: BotProfileSnapshot = { profiles: [], lastSuccess: null }

export function useBotProfiles(expanded: boolean) {
  const [snapshot, setSnapshot] = useState(saved)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    const bots = window.api?.bots
    if (!expanded || !bots) {
      return
    }
    let cancelled = false
    let pending = false
    const read = async () => {
      if (pending) {
        return
      }
      pending = true
      setBusy(true)
      try {
        const result = await bots.list(true)
        if (!cancelled) {
          saved = result
          setSnapshot(result)
        }
      } catch {
        if (!cancelled) {
          setSnapshot((old) => ({ ...old, error: 'Could not read bots. Retry Refresh.' }))
        }
      } finally {
        pending = false
        if (!cancelled) {
          setBusy(false)
        }
      }
    }
    const stop = installWindowVisibilityInterval({
      run: () => {
        void read()
      },
      intervalMs: 60_000
    })
    const onFocus = () => {
      void read()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      stop()
      window.removeEventListener('focus', onFocus)
    }
  }, [expanded, revision])
  return { snapshot, busy, refresh }
}
