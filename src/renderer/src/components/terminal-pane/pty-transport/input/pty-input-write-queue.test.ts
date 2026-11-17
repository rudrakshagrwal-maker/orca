import { describe, expect, it, vi } from 'vitest'
import { createPtyInputWriteQueue } from './pty-input-write-queue'
import { TERMINAL_INPUT_CHUNK_MAX_BYTES } from '../../../../../../shared/terminal/input/terminal-input'
import { CLIPBOARD_TEXT_MEASURE_YIELD_CODE_UNITS } from '../../../../../../shared/clipboard-text'
import {
  createDeferred,
  flushAsyncTicks
} from '../../pty-connection/test-fixtures/pty-connection-test-async'

type WriteRecord = { id: string; data: string }

function createRecordingQueue(options: { writable?: () => boolean } = {}): {
  writes: WriteRecord[]
  queue: ReturnType<typeof createPtyInputWriteQueue>
} {
  const writes: WriteRecord[] = []
  const queue = createPtyInputWriteQueue({
    isWritable: () => options.writable?.() ?? true,
    write: (id, data) => writes.push({ id, data })
  })
  return { writes, queue }
}

describe('pty input write queue', () => {
  it('contains drain failures and rejects input until queue reuse', async () => {
    const failure = new Error('write failed')
    const writes: WriteRecord[] = []
    let shouldThrow = true
    const onDrainFailure = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const queue = createPtyInputWriteQueue({
      isWritable: () => true,
      write: (id, data) => {
        if (shouldThrow) {
          throw failure
        }
        writes.push({ id, data })
      },
      onDrainFailure
    })

    try {
      expect(queue.enqueue('pty-1', 'stale', 'driving')).toBe(true)
      expect(queue.enqueue('pty-1', 'also-stale', 'driving')).toBe(false)
      await expect(queue.waitForDrain()).resolves.toBeUndefined()

      shouldThrow = false
      expect(queue.enqueue('pty-1', 'still-stale', 'driving')).toBe(false)
      queue.clear()
      expect(queue.enqueue('pty-1', 'fresh', 'driving')).toBe(true)
      await queue.waitForDrain()

      expect(writes).toEqual([{ id: 'pty-1', data: 'fresh' }])
      expect(warn).toHaveBeenCalledWith('[pty-input-write-queue] drain failed:', failure)
      expect(onDrainFailure).toHaveBeenCalledOnce()
    } finally {
      warn.mockRestore()
    }
  })

  it('serializes accepted input at its invocation position', async () => {
    const acceptedWrite = createDeferred<boolean>()
    const delivered: string[] = []
    const queue = createPtyInputWriteQueue({
      isWritable: () => true,
      write: (_id, data) => delivered.push(`ordinary:${data}`),
      writeAccepted: async (_id, data) => {
        delivered.push(`accepted:${data}`)
        return acceptedWrite.promise
      }
    })

    expect(queue.enqueue('pty-1', 'first', 'driving')).toBe(true)
    const accepted = queue.enqueueAccepted('pty-1', 'second', 'driving')
    expect(queue.enqueue('pty-1', 'third', 'driving')).toBe(true)
    expect(queue.enqueueQueryReply('pty-1', 'fourth')).toBe(true)
    await flushAsyncTicks()

    expect(delivered).toEqual(['ordinary:first', 'accepted:second'])

    acceptedWrite.resolve(true)
    await expect(accepted).resolves.toBe(true)
    await queue.waitForDrain()

    expect(delivered).toEqual([
      'ordinary:first',
      'accepted:second',
      'ordinary:third',
      'ordinary:fourth'
    ])
  })

  it('reserves one drain before an accepted write enqueues reentrantly', async () => {
    const acceptedWrite = createDeferred<boolean>()
    const delivered: string[] = []
    let reentered = false
    let queue!: ReturnType<typeof createPtyInputWriteQueue>
    queue = createPtyInputWriteQueue({
      isWritable: () => true,
      write: (_id, data) => delivered.push(`ordinary:${data}`),
      writeAccepted: async (_id, data) => {
        delivered.push(`accepted:${data}`)
        if (!reentered) {
          reentered = true
          queue.enqueue('pty-1', 'later', 'driving')
        }
        return acceptedWrite.promise
      }
    })

    const accepted = queue.enqueueAccepted('pty-1', 'first', 'driving')
    await flushAsyncTicks()

    expect(delivered).toEqual(['accepted:first'])

    acceptedWrite.resolve(true)
    await expect(accepted).resolves.toBe(true)
    await queue.waitForDrain()

    expect(delivered).toEqual(['accepted:first', 'ordinary:later'])
  })

  it('keeps draining fresh input when an accepted write clears reentrantly', async () => {
    const acceptedWrite = createDeferred<boolean>()
    const delivered: string[] = []
    let queue!: ReturnType<typeof createPtyInputWriteQueue>
    queue = createPtyInputWriteQueue({
      isWritable: () => true,
      write: (_id, data) => delivered.push(`ordinary:${data}`),
      writeAccepted: (_id, data) => {
        delivered.push(`accepted:${data}`)
        queue.clear()
        queue.enqueue('pty-1', 'fresh', 'driving')
        return acceptedWrite.promise
      }
    })

    const accepted = queue.enqueueAccepted('pty-1', 'stale', 'driving')

    await expect(accepted).resolves.toBe(false)
    await queue.waitForDrain()
    expect(delivered).toEqual(['accepted:stale', 'ordinary:fresh'])

    acceptedWrite.resolve(true)
    await flushAsyncTicks()

    expect(delivered).toEqual(['accepted:stale', 'ordinary:fresh'])
  })

  it('clear settles active and pending accepted input before same-id queue reuse', async () => {
    const acceptedWrite = createDeferred<boolean>()
    const acceptedStarted = createDeferred<void>()
    const delivered: string[] = []
    const queue = createPtyInputWriteQueue({
      isWritable: () => true,
      write: (_id, data) => delivered.push(`ordinary:${data}`),
      writeAccepted: async (_id, data) => {
        delivered.push(`accepted:${data}`)
        acceptedStarted.resolve()
        return acceptedWrite.promise
      }
    })
    const active = queue.enqueueAccepted('pty-1', 'stale-active', 'driving')
    const pending = queue.enqueueAccepted('pty-1', 'stale-pending', 'driving')
    await acceptedStarted.promise

    queue.clear()
    expect(queue.enqueue('pty-1', 'fresh', 'driving')).toBe(true)

    await expect(active).resolves.toBe(false)
    await expect(pending).resolves.toBe(false)
    await queue.waitForDrain()
    expect(delivered).toEqual(['accepted:stale-active', 'ordinary:fresh'])

    acceptedWrite.resolve(true)
    await flushAsyncTicks()

    expect(delivered).toEqual(['accepted:stale-active', 'ordinary:fresh'])
  })

  it('does not let a stale drain failure clear input queued after reuse', async () => {
    const failure = new Error('stale yield failed')
    const writes: WriteRecord[] = []
    let rejectYield: ((error: Error) => void) | undefined
    let rejectNextYield = true
    const onDrainFailure = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const queue = createPtyInputWriteQueue({
      isWritable: () => true,
      write: (id, data) => writes.push({ id, data }),
      yieldBetweenWrites: () => {
        if (!rejectNextYield) {
          return Promise.resolve()
        }
        return new Promise<void>((_resolve, reject) => {
          rejectYield = reject
        })
      },
      onDrainFailure
    })

    try {
      expect(
        queue.enqueue('pty-1', 'x'.repeat(TERMINAL_INPUT_CHUNK_MAX_BYTES * 2), 'driving')
      ).toBe(true)
      expect(rejectYield).toBeDefined()
      queue.clear()
      rejectNextYield = false
      expect(queue.enqueue('pty-2', 'fresh', 'driving')).toBe(true)
      rejectYield?.(failure)
      await queue.waitForDrain()

      expect(writes.at(-1)).toEqual({ id: 'pty-2', data: 'fresh' })
      expect(warn).toHaveBeenCalledWith('[pty-input-write-queue] drain failed:', failure)
      expect(onDrainFailure).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('clear() fences an in-flight validation before queue reuse', async () => {
    vi.useFakeTimers()
    const { writes, queue } = createRecordingQueue()
    const stale = 'é'.repeat(CLIPBOARD_TEXT_MEASURE_YIELD_CODE_UNITS + 1)

    try {
      expect(queue.enqueue('pty-1', stale, 'driving')).toBe(true)
      queue.clear()
      expect(queue.enqueue('pty-1', 'fresh', 'driving')).toBe(true)

      await vi.runAllTimersAsync()
      await queue.waitForDrain()

      expect(writes).toEqual([{ id: 'pty-1', data: 'fresh' }])
    } finally {
      vi.useRealTimers()
    }
  })
})

// RA: interrupted bracketed pastes close their frame; see pty-input-write-queue.ts.
describe('pty input write queue: interrupted bracketed paste', () => {
  const START = '\x1b[200~'
  const END = '\x1b[201~'
  const bigPaste = `${START}${'x'.repeat(TERMINAL_INPUT_CHUNK_MAX_BYTES * 2)}${END}`

  function createAcceptedQueue(accept: (data: string, call: number) => boolean | Error) {
    const sent: string[] = []
    const ordinary: string[] = []
    let call = 0
    const queue = createPtyInputWriteQueue({
      isWritable: () => true,
      write: (_id, data) => ordinary.push(data),
      writeAccepted: async (_id, data) => {
        call += 1
        const verdict = accept(data, call)
        if (verdict instanceof Error) {
          throw verdict
        }
        if (verdict) {
          sent.push(data)
        }
        return verdict
      }
    })
    return { queue, sent, ordinary }
  }

  it('closes the frame once after a mid-paste refusal, keeps queued input, never replays the payload', async () => {
    const { queue, sent, ordinary } = createAcceptedQueue((_d, call) => call !== 2)
    const paste = queue.enqueueAccepted('pty-1', bigPaste, 'driving')
    expect(queue.enqueue('pty-1', 'later', 'driving')).toBe(true)
    await expect(paste).resolves.toBe(false)
    await queue.waitForDrain()

    // Close lands after the first accepted chunk and before the unrelated input.
    expect(sent.at(-1)).toBe(END)
    // Only the accepted first chunk and the close went out: nothing of the payload is replayed.
    expect(sent).toHaveLength(2)
    expect(ordinary).toEqual(['later'])
  })

  it('treats an uncertain (thrown) acknowledgement like a refusal', async () => {
    const { queue, sent } = createAcceptedQueue((_d, call) =>
      call === 2 ? new Error('PTY write acknowledgment unavailable') : true
    )
    await expect(queue.enqueueAccepted('pty-1', bigPaste, 'driving')).resolves.toBe(false)
    expect(queue.enqueue('pty-1', 'next', 'driving')).toBe(true)
    await queue.waitForDrain()
    expect(sent.filter((d) => d === END)).toHaveLength(1)
  })

  it('keeps the obligation when the close itself is refused, then retries it before more text', async () => {
    let closeFails = true
    const { queue, sent, ordinary } = createAcceptedQueue((data, call) => {
      if (call === 2) {
        return false
      }
      return !(data === END && closeFails)
    })
    await expect(queue.enqueueAccepted('pty-1', bigPaste, 'driving')).resolves.toBe(false)
    expect(queue.enqueue('pty-1', 'lost', 'driving')).toBe(true)
    await queue.waitForDrain()
    expect(ordinary).toEqual([])

    closeFails = false
    expect(queue.enqueue('pty-1', 'fresh', 'driving')).toBe(true)
    await queue.waitForDrain()
    expect(sent.at(-1)).toBe(END)
    expect(ordinary).toEqual(['fresh'])
  })

  it('never closes framing on a replacement process', async () => {
    const { queue, sent, ordinary } = createAcceptedQueue((_d, call) => call !== 2)
    await expect(queue.enqueueAccepted('pty-1', bigPaste, 'driving')).resolves.toBe(false)
    queue.clear()
    expect(queue.enqueue('pty-1', 'fresh', 'driving')).toBe(true)
    await queue.waitForDrain()
    expect(sent.filter((d) => d === END)).toHaveLength(0)
    expect(ordinary).toEqual(['fresh'])
  })

  it('owes no close when a paste completes or is a single write', async () => {
    const { queue, sent } = createAcceptedQueue(() => true)
    await expect(queue.enqueueAccepted('pty-1', bigPaste, 'driving')).resolves.toBe(true)
    await expect(queue.enqueueAccepted('pty-1', `${START}hi${END}`, 'driving')).resolves.toBe(true)
    expect(sent.at(-1)).toBe(`${START}hi${END}`)
    expect(sent.filter((d) => d === END)).toHaveLength(0)
  })
})

// RA: a synchronous throw mid bracketed paste leaves the same close obligation as a refusal.
describe('pty input write queue: bracketed paste write throws', () => {
  const START = '\x1b[200~'
  const END = '\x1b[201~'
  const bigPaste = `${START}${'x'.repeat(TERMINAL_INPUT_CHUNK_MAX_BYTES * 2)}${END}`

  it('closes the frame, keeps queued input and does not fail the drain', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const onDrainFailure = vi.fn()
    const writes: string[] = []
    let calls = 0
    const queue = createPtyInputWriteQueue({
      isWritable: () => true,
      write: (_id, data) => {
        calls += 1
        if (calls === 2) {
          throw new Error('pty gone for a moment')
        }
        writes.push(data)
      },
      onDrainFailure
    })
    try {
      expect(queue.enqueue('pty-1', bigPaste, 'driving')).toBe(true)
      expect(queue.enqueue('pty-1', 'later', 'driving')).toBe(true)
      await queue.waitForDrain()

      expect(writes).toHaveLength(3)
      expect(writes[0].startsWith(START)).toBe(true)
      expect(writes.slice(1)).toEqual([END, 'later'])
      expect(onDrainFailure).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('still fails the drain for a throw outside a bracketed paste', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const onDrainFailure = vi.fn()
    const queue = createPtyInputWriteQueue({
      isWritable: () => true,
      write: () => {
        throw new Error('boom')
      },
      onDrainFailure
    })
    try {
      queue.enqueue('pty-1', 'x'.repeat(TERMINAL_INPUT_CHUNK_MAX_BYTES * 2), 'driving')
      await queue.waitForDrain()
      expect(onDrainFailure).toHaveBeenCalledOnce()
    } finally {
      warn.mockRestore()
    }
  })
})
