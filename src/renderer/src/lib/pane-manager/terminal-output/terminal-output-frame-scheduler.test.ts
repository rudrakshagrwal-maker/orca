import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeTerminalOutput } from './pane-terminal-output-scheduler'
import {
  discardTerminalOutput,
  queuedByTerminal,
  markTerminalOutputDrainStarted
} from './pane-terminal-output-queue-registry'
import { throttleTerminalOutputObserver } from './terminal-output-observer-throttle'

// RA: exercise real scheduling/credit ownership with manually advanced display frames.
describe('visible terminal frame scheduling', () => {
  let frames: FrameRequestCallback[]
  beforeEach(() => {
    vi.useFakeTimers()
    frames = []
    let frameId = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return ++frameId
    })
  })
  afterEach(() => {
    for (const terminal of queuedByTerminal.keys()) {
      discardTerminalOutput(terminal)
    }
    // RA: fake frames do not survive a test boundary.
    markTerminalOutputDrainStarted()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
  const nextFrame = (): void => {
    const callbacks = frames
    frames = []
    for (const callback of callbacks) {
      callback(performance.now())
    }
  }

  it('batches ordinary chunks until paint and withholds stream credit until parsing', () => {
    const rendered: string[] = []
    const parsed: (() => void)[] = []
    const terminal = {
      write: (data: string, callback?: () => void) => {
        rendered.push(data)
        if (callback) {
          parsed.push(callback)
        }
      }
    }
    let credited = 0
    const append = (data: string): void =>
      writeTerminalOutput(terminal, data, {
        foreground: true,
        latencySensitive: false,
        ackCredit: () => {
          credited++
        }
      })
    append('first ')
    append('हिन्दी')
    expect(rendered).toEqual([])
    nextFrame()
    expect(rendered).toEqual(['first हिन्दी'])
    expect(credited).toBe(0)
    append(' tail')
    nextFrame()
    expect(rendered).toEqual(['first हिन्दी'])
    parsed.shift()!()
    expect(credited).toBe(2)
    nextFrame()
    expect(rendered).toEqual(['first हिन्दी', ' tail'])
    parsed.shift()!()
    expect(credited).toBe(3)
    discardTerminalOutput(terminal)
    nextFrame()
  })

  // RA: a minimized renderer never fires rAF, but must still answer protocol queries.
  it('answers a protocol query behind queued output without any animation frame', () => {
    const replies: string[] = []
    const terminal = {
      write(data: string, parsed?: () => void) {
        if (data.includes('\x1b[c')) {
          replies.push('\x1b[?1;2c')
        }
        parsed?.()
      }
    }
    writeTerminalOutput(terminal, 'startup', { foreground: true })
    writeTerminalOutput(terminal, '\x1b[c', { foreground: true, protocolQuery: true })
    vi.advanceTimersByTime(20)
    expect(replies).toEqual(['\x1b[?1;2c'])
  })

  // RA: echo bypasses paint only when the pane has no predecessor.
  it('writes small interactive echo immediately and credits only after parsing', () => {
    const writes: string[] = []
    const parsed: (() => void)[] = []
    const credited = vi.fn()
    const terminal = {
      write(data: string, callback?: () => void) {
        writes.push(data)
        if (callback) {
          parsed.push(callback)
        }
      }
    }
    writeTerminalOutput(terminal, 'x', {
      foreground: true,
      latencySensitive: true,
      ackCredit: credited
    })
    expect(writes).toEqual(['x'])
    expect(credited).not.toHaveBeenCalled()
    parsed.shift()!()
    expect(credited).toHaveBeenCalledOnce()
  })

  it('appends interactive echo behind queued output and an in-flight parser', () => {
    const writes: string[] = []
    const parsed: (() => void)[] = []
    const terminal = {
      write(data: string, callback?: () => void) {
        writes.push(data)
        if (callback) {
          parsed.push(callback)
        }
      }
    }
    writeTerminalOutput(terminal, 'older', { foreground: true })
    writeTerminalOutput(terminal, 'x', { foreground: true, latencySensitive: true })
    expect(writes).toEqual([])
    nextFrame()
    expect(writes).toEqual(['olderx'])
    writeTerminalOutput(terminal, 'y', { foreground: true, latencySensitive: true })
    nextFrame()
    expect(writes).toEqual(['olderx'])
    parsed.shift()!()
    nextFrame()
    expect(writes).toEqual(['olderx', 'y'])
    parsed.shift()!()
  })

  it('publishes the newest title after a burst and never publishes into a disposed pane', () => {
    const titles: string[] = []
    let disposed = false
    const observe = throttleTerminalOutputObserver(
      (title: string) => titles.push(title),
      () => disposed
    )
    observe('working')
    observe('spinner one')
    observe('spinner two')
    vi.advanceTimersByTime(249)
    expect(titles).toEqual(['working'])
    vi.advanceTimersByTime(1)
    expect(titles).toEqual(['working', 'spinner two'])
    observe('obsolete')
    disposed = true
    vi.advanceTimersByTime(250)
    expect(titles).toEqual(['working', 'spinner two'])
  })
})
