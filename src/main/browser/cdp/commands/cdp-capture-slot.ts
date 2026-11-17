import type { WebContents } from 'electron'

// RA: one native screenshot at a time per guest. Chromium keeps a capture pending until the guest
// draws, so overlapping captures (and caller timeouts that freed the slot early) pile up on a
// hidden page. The slot frees when the native capture settles, never when a caller gives up.
type Waiter = {
  grant: (release: () => void) => void
  fail: (error: Error) => void
  isActive: () => boolean
  timer: NodeJS.Timeout
}
type Slot = { busy: boolean; waiters: Waiter[] }

const slots = new WeakMap<WebContents, Slot>()

function pump(slot: Slot): void {
  slot.busy = false
  while (slot.waiters.length > 0) {
    const next = slot.waiters.shift()!
    clearTimeout(next.timer)
    if (!next.isActive()) {
      next.fail(new Error('Screenshot caller disconnected'))
      continue
    }
    slot.busy = true
    next.grant(() => pump(slot))
    return
  }
}

/** Resolves with a release function once this guest has no native capture in flight. */
export function acquireCaptureSlot(
  webContents: WebContents,
  waitTimeoutMs: number,
  timeoutMessage: string,
  isActive: () => boolean = () => true
): Promise<() => void> {
  let slot = slots.get(webContents)
  if (!slot) {
    const created: Slot = { busy: false, waiters: [] }
    slot = created
    slots.set(webContents, created)
    // A destroyed guest never settles its pending capture; fail the queue instead of hanging it.
    webContents.once?.('destroyed', () => {
      for (const waiter of created.waiters.splice(0)) {
        clearTimeout(waiter.timer)
        waiter.fail(new Error('WebContents destroyed'))
      }
      slots.delete(webContents)
    })
  }
  const owned = slot
  if (!owned.busy) {
    owned.busy = true
    return Promise.resolve(() => pump(owned))
  }
  return new Promise((resolve, reject) => {
    const waiter: Waiter = {
      grant: resolve,
      fail: reject,
      isActive,
      timer: setTimeout(() => {
        owned.waiters = owned.waiters.filter((w) => w !== waiter)
        reject(new Error(timeoutMessage))
      }, waitTimeoutMs)
    }
    owned.waiters.push(waiter)
  })
}

/** RA: for streams: the slot if it is free right now, else null so the caller skips this frame. */
export function tryAcquireCaptureSlot(webContents: WebContents): (() => void) | null {
  let slot = slots.get(webContents)
  if (!slot) {
    slot = { busy: false, waiters: [] }
    slots.set(webContents, slot)
  }
  if (slot.busy) {
    return null
  }
  slot.busy = true
  const owned = slot
  return () => pump(owned)
}

/** RA: run one native capture alone on this guest; the slot frees when that capture settles. */
export async function runExclusiveCapture<T>(
  webContents: WebContents,
  capture: () => Promise<T>
): Promise<T> {
  const release = await acquireCaptureSlot(webContents, 30_000, 'Screenshot queue timed out')
  let pending: Promise<T>
  try {
    pending = capture()
  } catch (error) {
    release()
    throw error
  }
  void pending.then(release, release)
  return pending
}
