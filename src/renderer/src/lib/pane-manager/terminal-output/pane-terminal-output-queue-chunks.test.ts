import { describe, expect, it } from 'vitest'

import type { QueueEntry } from './pane-terminal-output-queue-registry'
import { enqueueChunk, takeQueuedChunk } from './pane-terminal-output-queue-chunks'
import { planTerminalOutputFrame } from './terminal-output-frame-budget'

function createEntry(): QueueEntry {
  return {
    terminal: {} as QueueEntry['terminal'],
    chunks: [],
    chunkIndex: 0,
    queuedChars: 0,
    backgroundBacklogDropped: false,
    highPriority: false,
    foregroundHold: false,
    foregroundHoldSafetyDelayMs: 0,
    foregroundCoalesce: false,
    foregroundCoalesceDelayMs: 0,
    foregroundHoldSafetyTimer: null,
    foregroundCoalesceTimer: null,
    foregroundReleaseDeadlineAt: null,
    foregroundReleaseDeadlineFixed: false,
    foregroundHoldSafetyExtended: false
  }
}

describe('pane terminal output queue chunks', () => {
  // RA: synthetic parser costs make the multi-agent flood reproducible on a low-RAM laptop.
  it('carries eight streaming panes across bounded frames without losing ANSI, Hindi or emoji', () => {
    const panes = Array.from({ length: 8 }, (_, id) => {
      const entry = createEntry()
      const chunks = Array.from({ length: 600 }, (_, n) =>
        n % 3 === 0 ? `\x1b[?2026h${'x'.repeat(31)}\x1b[?2026l` : `pane${id}: हिन्दी 👩‍💻\r\n`
      )
      for (const chunk of chunks) {
        enqueueChunk(entry, chunk, { foreground: true })
      }
      return { entry, expected: chunks.join(''), output: [] as string[] }
    })
    let pending = [...panes]
    let frames = 0
    while (pending.length > 0 && frames++ < 1000) {
      const plan = planTerminalOutputFrame(
        pending.map((pane) => ({
          pane,
          queuedChars: pane.entry.queuedChars,
          msPerChar: 0.002
        })),
        2
      )
      let bytes = 0
      let estimatedMs = 2
      for (const { pane, maxChars } of plan) {
        const write = takeQueuedChunk(pane.entry, maxChars)
        expect(write).not.toBeNull()
        const data = write!.data
        bytes += new TextEncoder().encode(data).length
        estimatedMs += maxChars * 0.002
        pane.output.push(data)
      }
      expect(bytes).toBeLessThanOrEqual(48 * 1024)
      expect(estimatedMs).toBeLessThanOrEqual(8)
      // The drain moves serviced panes behind siblings for the next frame.
      const serviced = new Set(plan.map(({ pane }) => pane))
      pending = [
        ...pending.filter((pane) => !serviced.has(pane)),
        ...plan.map(({ pane }) => pane)
      ].filter((pane) => pane.entry.queuedChars > 0)
    }
    expect(pending).toEqual([])
    for (const pane of panes) {
      expect(pane.output.join('')).toBe(pane.expected)
    }
    expect(planTerminalOutputFrame([{ pane: 1, queuedChars: 100, msPerChar: 0.002 }], 8)).toEqual(
      []
    )
    expect(planTerminalOutputFrame([{ pane: 1, queuedChars: 1, msPerChar: 0.002 }])).toEqual([
      { pane: 1, maxChars: 1 }
    ])
  })

  // RA: a frame boundary must preserve UTF-16 pairs, even with a one-cell remainder.
  it('carries a complete surrogate pair into the next write', () => {
    const entry = createEntry()
    enqueueChunk(entry, 'a😀b')
    expect(takeQueuedChunk(entry, 2)?.data).toBe('a')
    expect(takeQueuedChunk(entry, 2)?.data).toBe('😀')
    expect(takeQueuedChunk(entry, 2)?.data).toBe('b')
  })

  it('does not cut a queued chunk inside an open DEC 2026 frame', () => {
    const entry = createEntry()
    const open = '\x1b[?2026h'
    const close = '\x1b[?2026l'
    const firstFrame = `${open}aaaa${close}`
    const data = `${firstFrame}${open}bbbbbbbbbbbb${close}`
    enqueueChunk(entry, data, { foreground: true })

    // Stop after the first complete frame: a cut inside the next strands its close marker and freezes painting until drain/1000ms timeout.
    const taken = takeQueuedChunk(entry, firstFrame.length + 6)
    expect(taken?.data).toBe(firstFrame)
    const rest = takeQueuedChunk(entry, data.length)
    expect(`${taken?.data ?? ''}${rest?.data ?? ''}`).toBe(data)
    expect(entry.queuedChars).toBe(0)
  })
})
