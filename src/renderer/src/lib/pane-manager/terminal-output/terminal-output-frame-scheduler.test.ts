import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeTerminalOutput } from './pane-terminal-output-scheduler'
import { discardTerminalOutput, queuedByTerminal } from './pane-terminal-output-queue-registry'
import { throttleTerminalOutputObserver } from './terminal-output-observer-throttle'

// RA: exercise real scheduling/credit ownership with manually advanced display frames.
describe('visible terminal frame scheduling', () => {
  let frames: FrameRequestCallback[]
  beforeEach(() => {
    vi.useFakeTimers()
    frames = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
  })
  afterEach(() => {
    for (const terminal of queuedByTerminal.keys()) {
      discardTerminalOutput(terminal)
    }
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

  it('batches interactive chunks until paint and withholds stream credit until parsing', () => {
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
        latencySensitive: true,
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
