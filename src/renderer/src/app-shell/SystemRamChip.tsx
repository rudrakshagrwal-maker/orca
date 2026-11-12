// RA: One lightweight system sample for the titlebar, no per-terminal pollers.
import { useEffect, useState } from 'react'
export function SystemRamChip(): React.JSX.Element | null {
  const [percent, setPercent] = useState<number | null>(null)
  useEffect(() => {
    if (!window.api.app.systemRamPercent) return
    let active = true
    let pending = false
    const sample = async () => {
      if (pending) return
      pending = true
      try { const value = await window.api.app.systemRamPercent!(); if (active) setPercent(Number.isFinite(value) ? value : null) }
      catch { if (active) setPercent(null) }
      finally { pending = false }
    }
    void sample()
    const timer = window.setInterval(() => void sample(), 10_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  if (percent === null) return null
  return <span title="System RAM used" className={`self-center rounded-md border px-2 py-1 text-xs ${percent >= 80 ? 'text-destructive' : percent >= 75 ? 'text-status-warning-text' : 'text-muted-foreground'}`}>RAM {Math.floor(percent)}%</span>
}
