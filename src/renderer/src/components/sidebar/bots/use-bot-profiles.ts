// RA: Cached display first, one stale refresh per expansion, no background connection.
import { useEffect, useState, useCallback } from 'react'
import type { BotProfileSnapshot } from '../../../../../shared/bot-profile-types'
let saved: BotProfileSnapshot = { profiles: [], lastSuccess: null }
export function useBotProfiles(expanded: boolean) {
  const [snapshot, setSnapshot] = useState(saved)
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    if (!window.api.bots) return
    setBusy(true)
    try { saved = await window.api.bots.list(true); setSnapshot(saved) }
    catch { setSnapshot((old) => ({ ...old, error: 'Discovery unavailable; retry Refresh.' })) }
    finally { setBusy(false) }
  }, [])
  useEffect(() => {
    if (!expanded || !window.api.bots) return
    let cancelled = false
    void window.api.bots.list().then(async (cache) => {
      saved = cache
      if (cancelled) return
      setSnapshot(cache)
      if (!cache.lastSuccess || Date.now() - cache.lastSuccess > 300_000) await refresh()
    }).catch(() => { if (!cancelled) setSnapshot((old) => ({ ...old, error: 'Could not read bot profiles.' })) })
    return () => { cancelled = true }
  }, [expanded, refresh])
  return { snapshot, busy, refresh }
}
