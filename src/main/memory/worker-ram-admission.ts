// RA: No running process is killed; a queued start needs 30 continuous seconds below its limit.
import { collectHostMemory } from './host-memory'
import { workerRamLimit, type WorkerRamQueueRow } from '../../shared/worker-ram-queue'

export class WorkerRamAdmission {
  private belowSince: number | null = null
  constructor(private readonly threshold: () => number) {}
  reset(): void { this.belowSince = null } // RA: one launch invalidates older recovery observations.
  shouldQueue(percent: number): boolean {
    return !Number.isFinite(percent) || percent > workerRamLimit(this.threshold())
  }
  ready(percent: number, now: number): boolean {
    if (!Number.isFinite(percent) || percent >= workerRamLimit(this.threshold())) {
      this.belowSince = null
      return false
    }
    this.belowSince ??= now
    return now - this.belowSince >= 30_000
  }
}

type Entry = { row: WorkerRamQueueRow; admission: WorkerRamAdmission; current: () => boolean; run: () => Promise<unknown> }
const entries = new Map<string, Entry>()
const launchingIds = new Set<string>() // RA: retain requests can arrive before the deferred process binds.
const retainRequested = new Set<string>()
export function retainRamQueuedWorker(id: string): boolean {
  if (!entries.has(id) && !launchingIds.has(id)) return false
  retainRequested.add(id)
  return true
}
export const takeRamQueuedWorkerRetention = (id: string): boolean => retainRequested.delete(id)
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined
let sampling = false
let launching = false
export const workerRamQueueSnapshot = (): WorkerRamQueueRow[] => [...entries.values()].map((e) => ({ ...e.row }))
export const subscribeWorkerRamQueue = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const publish = () => listeners.forEach((listener) => { try { listener() } catch { /* UI teardown cannot strand a queued start. */ } })

export async function queueWorkerAboveRam(args: {
  row: Omit<WorkerRamQueueRow, 'percent' | 'queuedAt'>
  limit: () => number
  current: () => boolean
  run: () => Promise<unknown>
}): Promise<boolean> {
  const admission = new WorkerRamAdmission(args.limit)
  const percent = (await collectHostMemory()).memoryUsagePercent
  if (!admission.shouldQueue(percent)) return false
  if (entries.has(args.row.id)) return true
  entries.set(args.row.id, { ...args, row: { ...args.row, percent, queuedAt: Date.now() }, admission })
  publish()
  timer ??= setInterval(() => void drain(), 5_000)
  timer.unref()
  return true
}

async function drain(): Promise<void> {
  if (sampling || launching) return
  sampling = true
  try {
    const percent = (await collectHostMemory()).memoryUsagePercent
    for (const [id, entry] of entries) {
      let current = false // RA: a closed profile's DB cannot hold up another profile's queue.
      try { current = entry.current() } catch { /* Disposed owner. */ }
      if (!current) { entries.delete(id); retainRequested.delete(id); continue }
      entry.row.percent = percent
      if (!entry.admission.ready(percent, Date.now())) continue
      entries.delete(id)
      launchingIds.add(id)
      for (const other of entries.values()) other.admission.reset()
      launching = true
      publish()
      // Serial admission avoids waking the whole queue against one low-memory sample.
      try { if (entry.current()) await entry.run() }
      catch { console.warn('[worker RAM queue] deferred start failed; inspect its dispatch', id) }
      finally { launching = false; launchingIds.delete(id); retainRequested.delete(id) }
      break
    }
    publish()
  } catch { /* Retain the queue when system memory cannot be read. */ }
  finally {
    sampling = false
    if (!entries.size && timer) { clearInterval(timer); timer = undefined }
  }
}
