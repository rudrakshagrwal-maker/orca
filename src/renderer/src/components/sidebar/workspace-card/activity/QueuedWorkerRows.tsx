// RA: A shared push subscription displays queued workers without tabs or xterm instances.
import { useSyncExternalStore } from 'react'
import type { WorkerRamQueueRow } from '../../../../../../shared/worker-ram-queue'
let rows: WorkerRamQueueRow[] = []
const listeners = new Set<() => void>()
let unsubscribe: (() => void) | undefined
let generation = 0
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    const current = ++generation
    let pushed = false
    const publish = (next: WorkerRamQueueRow[]) => { if (current !== generation) return; rows = next; listeners.forEach((fn) => fn()) }
    unsubscribe = window.api.app.onWorkerRamQueueChanged?.((next) => { pushed = true; publish(next) })
    void window.api.app.workerRamQueue?.().then((next) => { if (!pushed) publish(next) }).catch(() => {})
  }
  return () => { listeners.delete(listener); if (!listeners.size) { generation++; unsubscribe?.(); unsubscribe = undefined } }
}
export function QueuedWorkerRows({ worktreeId }: { worktreeId: string }): React.JSX.Element | null {
  const queue = useSyncExternalStore(subscribe, () => rows)
  const pending = queue.filter((row) => row.worktreeId === worktreeId)
  if (!pending.length) return null
  return <div className="ml-4 space-y-1 text-xs text-muted-foreground">{pending.map((row) => <div key={row.id} title={row.parentHandle}>{row.label}: queued: RAM {Math.round(row.percent)}%</div>)}</div>
}
