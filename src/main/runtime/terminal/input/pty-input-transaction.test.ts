import { describe, expect, it } from 'vitest'
import {
  acquirePtyInputTransaction,
  isInputTransactionBypass,
  isPtyInputTransactionHeld,
  writeAfterPtyInputTransaction
} from './pty-input-transaction'

// RA: per-PTY input transactions.
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5))

describe('PTY input transactions', () => {
  it('grants the PTY to one holder at a time, in arrival order, per PTY', async () => {
    const order: string[] = []
    const releaseA = await acquirePtyInputTransaction('pty-a')
    const second = acquirePtyInputTransaction('pty-a').then((release) => {
      order.push('second')
      return release
    })
    const third = acquirePtyInputTransaction('pty-a').then((release) => {
      order.push('third')
      return release
    })
    const otherPty = await acquirePtyInputTransaction('pty-b')
    await tick()
    expect(order).toEqual([])
    expect(isPtyInputTransactionHeld('pty-a')).toBe(true)

    releaseA()
    ;(await second)()
    ;(await third)()
    otherPty()
    expect(order).toEqual(['second', 'third'])
    expect(isPtyInputTransactionHeld('pty-a')).toBe(false)
    expect(isPtyInputTransactionHeld('pty-b')).toBe(false)
  })

  it('release is idempotent and an aborted waiter keeps later waiters in order', async () => {
    const release = await acquirePtyInputTransaction('pty-c')
    const controller = new AbortController()
    const aborted = acquirePtyInputTransaction('pty-c', controller.signal)
    const rejection = expect(aborted).rejects.toThrow('request_aborted')
    let next = false
    const later = acquirePtyInputTransaction('pty-c').then((r) => {
      next = true
      return r
    })
    controller.abort()
    await rejection
    await tick()
    expect(next).toBe(false)

    release()
    release()
    ;(await later)()
    expect(next).toBe(true)
    expect(isPtyInputTransactionHeld('pty-c')).toBe(false)
  })

  it('refuses an already-cancelled request without taking the PTY', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(acquirePtyInputTransaction('pty-d', controller.signal)).rejects.toThrow(
      'request_aborted'
    )
    expect(isPtyInputTransactionHeld('pty-d')).toBe(false)
  })

  it('defers ordinary writes until holders finish, keeps their order, and skips the wait when idle', async () => {
    expect(writeAfterPtyInputTransaction('pty-e', () => 'now')).toBe('now')

    const release = await acquirePtyInputTransaction('pty-e')
    const seen: string[] = []
    const a = writeAfterPtyInputTransaction('pty-e', () => seen.push('a'))
    const b = writeAfterPtyInputTransaction('pty-e', () => seen.push('b'))
    await tick()
    expect(seen).toEqual([])
    // RA: a transaction that asks after the deferred writes queues behind them (FIFO).
    const next = acquirePtyInputTransaction('pty-e')
    let nextHas = false
    void next.then(() => {
      nextHas = true
    })
    release()
    await Promise.all([a, b])
    expect(seen).toEqual(['a', 'b'])
    const releaseNext = await next
    expect(nextHas).toBe(true)
    releaseNext()
    expect(isPtyInputTransactionHeld('pty-e')).toBe(false)
  })

  it('names the input that must bypass a transaction', () => {
    expect(isInputTransactionBypass('\x03')).toBe(true)
    expect(isInputTransactionBypass('\x1b')).toBe(true)
    expect(isInputTransactionBypass('\x1b[1;1R', 'query-reply')).toBe(true)
    expect(isInputTransactionBypass('\x1b[A')).toBe(false)
    expect(isInputTransactionBypass('hello\r')).toBe(false)
    // RA: only a lone Ctrl+C bypasses; a paste that contains one waits.
    expect(isInputTransactionBypass('abc\x03')).toBe(false)
    expect(isInputTransactionBypass('\x03\x03')).toBe(false)
  })

  it('bypasses terminal replies by shape, even labelled driving, and nothing wider', () => {
    for (const reply of [
      '\x1b[12;40R',
      '\x1b[?62;4c',
      '\x1b[>0;276;0c',
      '\x1b[0n',
      '\x1b[?997;1n',
      '\x1b[?2004;2$y',
      '\x1b]11;rgb:1e1e/1e1e/1e1e\x07',
      '\x1b]10;rgb:ffff/ffff/ffff\x1b\\',
      '\x1b[1;1R\x1b[?62c'
    ]) {
      expect(isInputTransactionBypass(reply, 'driving')).toBe(true)
    }
    for (const typed of [
      '\x1b[A',
      '\x1b[1;1Rx',
      'x\x1b[1;1R',
      '\x1b[200~hi\x1b[201~',
      '\x1b[31m'
    ]) {
      expect(isInputTransactionBypass(typed, 'driving')).toBe(false)
    }
  })
})
