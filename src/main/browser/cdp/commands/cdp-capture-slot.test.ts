import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import {
  acquireCaptureSlot,
  CAPTURE_SLOT_HARD_CEILING_MS,
  runExclusiveCapture,
  tryAcquireCaptureSlot
} from './cdp-capture-slot'
import { captureScreenshot } from './cdp-screenshot'

function mockWc() {
  const listeners: Record<string, () => void> = {}
  const mock = {
    id: 9,
    isDestroyed: vi.fn(() => false),
    invalidate: vi.fn(),
    capturePage: vi.fn(),
    once: vi.fn((event: string, cb: () => void) => {
      listeners[event] = cb
    }),
    debugger: { isAttached: vi.fn(() => true), sendCommand: vi.fn() }
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: mock covers the members used.
  return { mock, listeners, guest: mock as unknown as WebContents }
}
const noHold = (): (() => void) => () => {}

describe('capture slot', () => {
  it('serializes concurrent requests', async () => {
    const { guest } = mockWc()
    const order: string[] = []
    const r1 = await acquireCaptureSlot(guest, 1000, 't')
    const second = acquireCaptureSlot(guest, 1000, 't').then((r) => {
      order.push('second')
      return r
    })
    await Promise.resolve()
    expect(order).toEqual([])
    r1()
    ;(await second)()
    expect(order).toEqual(['second'])
  })

  it('a timed-out caller does not free the slot while the native capture is pending', async () => {
    vi.useFakeTimers()
    try {
      const { guest, mock } = mockWc()
      let resolveNative: (v: unknown) => void = () => {}
      mock.debugger.sendCommand.mockImplementation(
        () => new Promise((r) => (resolveNative = r))
      )
      mock.capturePage.mockRejectedValue(new Error('no frame'))
      const first = captureScreenshot(guest, { format: 'png' }, noHold)
      const firstResult = first.catch((e: Error) => e.message)
      const second = captureScreenshot(guest, { format: 'png' }, noHold)
      const secondResult = second.catch((e: Error) => e.message)
      await vi.advanceTimersByTimeAsync(20000)
      expect(await firstResult).toMatch(/timed out/)
      expect(await secondResult).toMatch(/timed out/)
      // Only the first native capture ever started; the second never got the slot.
      expect(mock.debugger.sendCommand).toHaveBeenCalledTimes(1)
      resolveNative({ data: 'x' })
      await vi.advanceTimersByTimeAsync(0)
      const third = captureScreenshot(guest, { format: 'png' }, noHold)
      await vi.advanceTimersByTimeAsync(0)
      expect(mock.debugger.sendCommand).toHaveBeenCalledTimes(2)
      resolveNative({ data: 'y' })
      await expect(third).resolves.toEqual({ data: 'y' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('drops a queued caller that disconnected', async () => {
    const { guest } = mockWc()
    const r1 = await acquireCaptureSlot(guest, 1000, 't')
    let active = true
    const queued = acquireCaptureSlot(guest, 1000, 't', () => active)
    active = false
    r1()
    await expect(queued).rejects.toThrow('disconnected')
    // slot is free again
    ;(await acquireCaptureSlot(guest, 1000, 't'))()
  })

  it('a destroyed guest clears its queue', async () => {
    const { guest, listeners } = mockWc()
    await acquireCaptureSlot(guest, 1000, 't')
    const queued = acquireCaptureSlot(guest, 1000, 't')
    listeners.destroyed()
    await expect(queued).rejects.toThrow('destroyed')
  })

  it('a stream frame is skipped while a capture holds the slot', async () => {
    const { guest } = mockWc()
    const release = await acquireCaptureSlot(guest, 1000, 't')
    expect(tryAcquireCaptureSlot(guest)).toBeNull()
    release()
    const free = tryAcquireCaptureSlot(guest)
    expect(free).not.toBeNull()
    free?.()
  })

  it('exclusive captures never overlap and release when the native capture settles', async () => {
    const { guest } = mockWc()
    let running = 0
    let peak = 0
    const run = () =>
      runExclusiveCapture(guest, async () => {
        running += 1
        peak = Math.max(peak, running)
        await new Promise((r) => setTimeout(r, 5))
        running -= 1
        return 'ok'
      })
    await expect(Promise.all([run(), run(), run()])).resolves.toEqual(['ok', 'ok', 'ok'])
    expect(peak).toBe(1)
  })

  // RA: the stream path creates the slot too, so a destroyed guest must still clear its queue.
  it('a slot created by the stream path also listens for the guest being destroyed', async () => {
    const { guest, listeners } = mockWc()
    const release = tryAcquireCaptureSlot(guest)
    expect(release).not.toBeNull()
    expect(listeners.destroyed).toBeTypeOf('function')
    const queued = acquireCaptureSlot(guest, 1000, 't')
    listeners.destroyed()
    await expect(queued).rejects.toThrow('destroyed')
  })

  // RA: a native capture that never settles must not starve later screenshots.
  it('force-releases a stuck capture after the hard ceiling and ignores its late release', async () => {
    vi.useFakeTimers()
    try {
      const { guest } = mockWc()
      const stuck = await acquireCaptureSlot(guest, 60_000, 't')
      const next = acquireCaptureSlot(guest, 60_000, 't')
      let granted = false
      void next.then(() => {
        granted = true
      })
      await vi.advanceTimersByTimeAsync(CAPTURE_SLOT_HARD_CEILING_MS - 1)
      expect(granted).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(granted).toBe(true)
      // The stuck capture finally settles: it must not free the slot the next capture now holds.
      stuck()
      expect(tryAcquireCaptureSlot(guest)).toBeNull()
      ;(await next)()
      const free = tryAcquireCaptureSlot(guest)
      expect(free).not.toBeNull()
      free?.()
    } finally {
      vi.useRealTimers()
    }
  })
})
