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
// RA: a native capture on a hidden page that never paints never settles. After this ceiling the slot is
// force-released and that capture's late release is ignored, so later screenshots are not starved.
export const CAPTURE_SLOT_HARD_CEILING_MS = 20_000
type Slot = { busy: boolean; waiters: Waiter[]; hold: object | null }

const slots = new WeakMap<WebContents, Slot>()

/** RA: marks the slot busy and returns its release; a release from an earlier, force-freed hold does nothing. */
function takeSlot(slot: Slot): () => void {
  const hold = {}
  slot.busy = true
  slot.hold = hold
  const timer = setTimeout(() => {
    if (slot.hold === hold) {
      pump(slot)
    }
  }, CAPTURE_SLOT_HARD_CEILING_MS)
  timer.unref?.()
  return () => {
    clearTimeout(timer)
    if (slot.hold === hold) {
      pump(slot)
    }
  }
}

// RA: the one place a slot is created, so every path gets the guest `destroyed` listener.
function getSlot(webContents: WebContents): Slot {
  let slot = slots.get(webContents)
  if (!slot) {
    const created: Slot = { busy: false, waiters: [], hold: null }
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
  return slot
}

function pump(slot: Slot): void {
  slot.busy = false
  slot.hold = null
  while (slot.waiters.length > 0) {
    const next = slot.waiters.shift()!
    clearTimeout(next.timer)
    if (!next.isActive()) {
      next.fail(new Error('Screenshot caller disconnected'))
      continue
    }
    next.grant(takeSlot(slot))
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
  const slot = getSlot(webContents)
  const owned = slot
  if (!owned.busy) {
    return Promise.resolve(takeSlot(owned))
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
  const slot = getSlot(webContents)
  return slot.busy ? null : takeSlot(slot)
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
