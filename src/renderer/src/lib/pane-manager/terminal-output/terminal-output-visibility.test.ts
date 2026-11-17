import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.resetModules()
})

// RA: minimizing replaces a suspended display frame; focus rearms a lost outstanding frame.
it.each(['visibilitychange', 'focus'])(
  'rearms outstanding output on %s without firing the old frame',
  async (event) => {
    vi.resetModules()
    vi.useFakeTimers()
    const document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    const window = new EventTarget()
    vi.stubGlobal('document', document)
    vi.stubGlobal('window', window)
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const { writeTerminalOutput } = await import('./pane-terminal-output-scheduler')
    const { discardTerminalOutput } = await import('./pane-terminal-output-queue-registry')
    const replies: string[] = []
    const terminal = {
      write(data: string, parsed?: () => void) {
        if (data === '\x1b[c') {
          replies.push('\x1b[?1;2c')
        }
        parsed?.()
      }
    }
    writeTerminalOutput(terminal, '\x1b[c', { foreground: true })
    document.visibilityState = 'hidden'
    ;(event === 'focus' ? window : document).dispatchEvent(new Event(event))
    await vi.advanceTimersByTimeAsync(20)
    expect(replies).toEqual(['\x1b[?1;2c'])
    discardTerminalOutput(terminal)
  }
)
