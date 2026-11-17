import { afterEach, describe, expect, it, vi } from 'vitest'
import { RuntimeTerminalWriter } from './runtime-terminal-writer'

import {
  WRITE_ACCEPTED,
  type WriteSettlement
} from '../../../../shared/terminal/pty/lifecycle/pty-write-settlement'
import { TERMINAL_INPUT_CHUNK_MAX_BYTES } from '../../../../shared/terminal/input/terminal-input'

afterEach(() => vi.useRealTimers())

describe('requested terminal write settlement', () => {
  it('waits for complete body settlement before suffix and host acknowledgment', async () => {
    vi.useFakeTimers()
    const raw = vi.fn((_id: string, _data: string) => true)
    const bytes: string[] = []
    let finish: (result: WriteSettlement) => void = () => {
      throw new Error('write not started')
    }
    const settled = vi.fn((_id: string, data: string) => {
      bytes.push(data)
      return bytes.length === 1
        ? new Promise<WriteSettlement>((resolve) => {
            finish = resolve
          })
        : WRITE_ACCEPTED
    })
    const writer = new RuntimeTerminalWriter(
      raw,
      () => 'linux',
      () => null,
      settled
    )
    const text = 'x'.repeat(TERMINAL_INPUT_CHUNK_MAX_BYTES + 1)
    const pending = writer.writeAction('pty', { text, enter: true }, `${text}\r`, {
      inputKind: 'driving',
      requireWriteSettlement: true
    })
    await vi.advanceTimersByTimeAsync(2000)
    expect(bytes).toHaveLength(1)
    finish(WRITE_ACCEPTED)
    await vi.advanceTimersByTimeAsync(2000)
    await expect(pending).resolves.toEqual(WRITE_ACCEPTED)
    expect(bytes.join('')).toBe(`${text}\r`)
    expect(bytes.at(-1)).toBe('\r')
    expect(raw).not.toHaveBeenCalled()
  })
})

describe('submit settle before Enter', () => {
  /** An idle proof the test settles by hand, after advancing the fake clock. */
  function heldProof(): { claim: () => Promise<boolean>; settle: (idle: boolean) => void } {
    let settle: (idle: boolean) => void = () => {
      throw new Error('proof not started')
    }
    const proof = new Promise<boolean>((resolve) => {
      settle = resolve
    })
    return { claim: () => proof, settle: (idle) => settle(idle) }
  }

  it('does not submit when the send is cancelled during a successful idle proof', async () => {
    vi.useFakeTimers()
    const writes: string[] = []
    const controller = new AbortController()
    const proof = heldProof()
    const writer = new RuntimeTerminalWriter(
      (_id, data) => {
        writes.push(data)
        return true
      },
      () => 'linux',
      () => null,
      undefined,
      proof.claim
    )
    const pending = writer.writeAction('pty', { text: 'ls', enter: true }, 'ls\r', {
      inputKind: 'driving',
      signal: controller.signal
    })
    const rejected = expect(pending).rejects.toThrow('request_aborted')
    await vi.advanceTimersByTimeAsync(100)
    controller.abort()
    proof.settle(true)
    await vi.advanceTimersByTimeAsync(1000)
    await rejected
    expect(writes).toEqual(['ls'])
  })
})

describe('Enter after text for a Windows input-record agent', () => {
  it('caps the burst wait so a long message still answers inside a phone RPC timeout', async () => {
    vi.useFakeTimers()
    const startedAt = Date.now()
    let enterAt: number | undefined
    const writer = new RuntimeTerminalWriter(
      (_id, data) => {
        if (data === '\r') {
          enterAt = Date.now() - startedAt
        }
        // RA: the paste boundary is refused here, so the timed fallback is what runs.
        return data !== '[C'
      },
      () => 'win32',
      () => 'codex'
    )
    // 10k chars would be a 30 s burst wait uncapped, past the phone's 30 s terminal.send timeout.
    const text = 'm'.repeat(10_000)
    const pending = writer.writeAction('pty', { text, enter: true }, `${text}\r`, {
      inputKind: 'driving'
    })
    await vi.runAllTimersAsync()
    await pending
    expect(enterAt).toBeGreaterThanOrEqual(19_000)
    expect(enterAt).toBeLessThanOrEqual(20_000)
  })
})

// RA: deterministic paste boundary and whole-send transactions.
describe('Windows Codex paste boundary', () => {
  const BOUNDARY = '\x1b[C'

  function recordingWriter(platform: NodeJS.Platform, agent: 'codex' | 'claude') {
    const startedAt = Date.now()
    const writes: { data: string; at: number }[] = []
    const writer = new RuntimeTerminalWriter(
      (_id, data) => {
        writes.push({ data, at: Date.now() - startedAt })
        return true
      },
      () => platform,
      () => agent
    )
    return { writer, writes }
  }

  it('sends Right after the paste and Enter after ingest only, not the 20 s burst estimate', async () => {
    vi.useFakeTimers()
    const { writer, writes } = recordingWriter('win32', 'codex')
    const text = 'm'.repeat(10_000)
    const pending = writer.writeAction('pty', { text, enter: true }, `${text}\r`, {
      inputKind: 'driving'
    })
    await vi.runAllTimersAsync()
    await pending
    expect(writes.map((write) => write.data)).toEqual([text, BOUNDARY, '\r'])
    expect(writes[2].at).toBeLessThan(2_000)
  })

  it('does not send the boundary to Codex on macOS or to other agents on Windows', async () => {
    vi.useFakeTimers()
    for (const [platform, agent] of [
      ['darwin', 'codex'],
      ['win32', 'claude']
    ] as const) {
      const { writer, writes } = recordingWriter(platform, agent)
      const pending = writer.writeAction('pty', { text: 'hi', enter: true }, 'hi\r', {
        inputKind: 'driving'
      })
      await vi.runAllTimersAsync()
      await pending
      expect(writes.map((write) => write.data)).toEqual(['hi', '\r'])
    }
  })

  it('keeps the timed burst wait when the boundary settlement is refused or lost', async () => {
    vi.useFakeTimers()
    for (const verdict of ['refused', 'throws'] as const) {
      const startedAt = Date.now()
      let enterAt = 0
      const writer = new RuntimeTerminalWriter(
        () => true,
        () => 'win32',
        () => 'codex',
        async (_id, data) => {
          if (data === BOUNDARY) {
            if (verdict === 'throws') {
              throw new Error('ack lost')
            }
            return { outcome: 'refused', reason: 'provider_cannot_settle' } as WriteSettlement
          }
          if (data === '\r') {
            enterAt = Date.now() - startedAt
          }
          return WRITE_ACCEPTED
        }
      )
      const text = 'm'.repeat(10_000)
      const pending = writer.writeAction('pty', { text, enter: true }, `${text}\r`, {
        inputKind: 'driving',
        requireWriteSettlement: true
      })
      await vi.runAllTimersAsync()
      await expect(pending).resolves.toEqual(WRITE_ACCEPTED)
      expect(enterAt).toBeGreaterThanOrEqual(19_000)
    }
  })
})

describe('one send is one input transaction', () => {
  it('queues a bare text write (a permission answer) behind a send holding the PTY', async () => {
    vi.useFakeTimers()
    const writes: string[] = []
    const writer = new RuntimeTerminalWriter(
      (_id, data) => {
        writes.push(data)
        return true
      },
      () => 'linux',
      () => null
    )
    const send = writer.writeAction('pty', { text: 'prompt', enter: true }, 'prompt\r', {
      inputKind: 'driving'
    })
    const answer = writer.writeChunks('pty', 'y', { inputKind: 'driving' })
    await vi.advanceTimersByTimeAsync(100)
    expect(writes).toEqual(['prompt'])
    await vi.advanceTimersByTimeAsync(2_000)
    await Promise.all([send, answer])
    expect(writes).toEqual(['prompt', '\r', 'y'])
  })

  function plainWriter(writes: string[]): RuntimeTerminalWriter {
    return new RuntimeTerminalWriter(
      (id, data) => {
        // Writes to the other PTY carry a prefix so the two streams stay apart.
        writes.push(id === 'pty' ? data : `${id}:${data}`)
        return true
      },
      () => 'linux',
      () => null
    )
  }

  it('holds a second send behind the first through its Enter; Ctrl+C and other PTYs go straight through', async () => {
    vi.useFakeTimers()
    const writes: string[] = []
    const writer = plainWriter(writes)
    const first = writer.writeAction('pty', { text: 'first', enter: true }, 'first\r', {
      inputKind: 'driving'
    })
    const second = writer.writeAction('pty', { text: 'second', enter: true }, 'second\r', {
      inputKind: 'driving'
    })
    const other = writer.writeAction('other-pty', { text: 'free', enter: true }, 'free\r', {
      inputKind: 'driving'
    })
    await vi.advanceTimersByTimeAsync(100)
    expect(writes).toEqual(['first', 'other-pty:free'])

    await writer.writeAction('pty', { interrupt: true }, '\x03', { inputKind: 'driving' })
    expect(writes).toEqual(['first', 'other-pty:free', '\x03'])

    await vi.runAllTimersAsync()
    await Promise.all([first, second, other])
    expect(writes.filter((data) => !data.startsWith('other-pty:') && data !== '\x03')).toEqual([
      'first',
      '\r',
      'second',
      '\r'
    ])
  })

  it('lets the next send proceed when an earlier queued send is cancelled', async () => {
    vi.useFakeTimers()
    const writes: string[] = []
    const writer = plainWriter(writes)
    const controller = new AbortController()
    const first = writer.writeAction('pty', { text: 'a', enter: true }, 'a\r', {
      inputKind: 'driving'
    })
    const cancelled = writer.writeAction('pty', { text: 'b', enter: true }, 'b\r', {
      inputKind: 'driving',
      signal: controller.signal
    })
    const third = writer.writeAction('pty', { text: 'c', enter: true }, 'c\r', {
      inputKind: 'driving'
    })
    const rejected = expect(cancelled).rejects.toThrow('request_aborted')
    controller.abort()
    await rejected
    // Each send waits out its own settle delay, so step the clock once per send.
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.advanceTimersByTimeAsync(2_000)
    await Promise.all([first, third])
    expect(writes).toEqual(['a', '\r', 'c', '\r'])
  })
})
