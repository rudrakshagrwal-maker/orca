import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushTerminalOutput, writeTerminalOutput } from './pane-terminal-output-scheduler'
import {
  discardTerminalOutput,
  setTerminalOutputSuspended
} from './pane-terminal-output-queue-registry'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

// RA: hidden remote/local output must reach xterm only after reveal, in stream order.
it('buffers output while hidden, including flush requests, then replays it on reveal', () => {
  let screen = ''
  const terminal = {
    write(data: string, callback?: () => void) {
      screen += data
      callback?.()
    }
  }
  setTerminalOutputSuspended(terminal, true)
  writeTerminalOutput(terminal, 'first\n', { foreground: true })
  writeTerminalOutput(terminal, 'second\n', { foreground: false })
  flushTerminalOutput(terminal)
  vi.advanceTimersByTime(60_000)
  expect(screen).toBe('')
  setTerminalOutputSuspended(terminal, false)
  flushTerminalOutput(terminal)
  expect(screen).toBe('first\nsecond\n')
  discardTerminalOutput(terminal)
})

// RA: suspension credits queued delivery without claiming that xterm parsed it.
it('returns delivery credit once on hide and delays parser callbacks until reveal', () => {
  let screen = ''
  let credits = 0
  let parsed = 0
  const terminal = {
    write(data: string, callback?: () => void) {
      screen += data
      callback?.()
    }
  }
  const options = {
    foreground: false,
    ackCredit: () => {
      credits += 1
    },
    onParsed: () => {
      parsed += 1
    }
  }
  writeTerminalOutput(terminal, 'queued', options)
  setTerminalOutputSuspended(terminal, true)
  writeTerminalOutput(terminal, '-hidden', options)
  vi.advanceTimersByTime(60_000)
  expect(screen).toBe('')
  expect(credits).toBe(2)
  expect(parsed).toBe(0)
  setTerminalOutputSuspended(terminal, false)
  flushTerminalOutput(terminal)
  expect(screen).toBe('queued-hidden')
  expect(credits).toBe(2)
  expect(parsed).toBe(2)
  discardTerminalOutput(terminal)
})
