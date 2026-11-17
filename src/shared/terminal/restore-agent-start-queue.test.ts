import { afterEach, expect, it, vi } from 'vitest'
import { RestoreAgentStartQueue } from './restore-agent-start-queue'

afterEach(() => vi.useRealTimers())

// RA: verify active-first restore, serial admission, the 150ms gap, and immediate shells.
it('restores the active tab first, spaces agents, and never holds a plain shell', async () => {
  vi.useFakeTimers()
  const queue = new RestoreAgentStartQueue()
  const started: string[] = []
  let finish!: () => void
  const hidden = queue.run(
    'claude',
    () => false,
    async () => {
      started.push('hidden')
    }
  )
  const active = queue.run(
    'codex',
    () => true,
    async () => {
      started.push('active')
      await new Promise<void>((resolve) => {
        finish = resolve
      })
    }
  )
  const activeSibling = queue.run(
    'claude',
    () => true,
    async () => {
      started.push('active sibling')
    }
  )
  await queue.run(
    undefined,
    () => false,
    async () => {
      started.push('shell')
    }
  )
  expect(started).toEqual(['shell'])
  await vi.advanceTimersByTimeAsync(0)
  expect(started).toEqual(['shell', 'active'])
  await vi.advanceTimersByTimeAsync(1000)
  expect(started).toEqual(['shell', 'active'])
  finish()
  await active
  await vi.advanceTimersByTimeAsync(149)
  expect(started).toEqual(['shell', 'active'])
  await vi.advanceTimersByTimeAsync(1)
  expect(started).toEqual(['shell', 'active', 'active sibling'])
  await vi.advanceTimersByTimeAsync(150)
  expect(started).toEqual(['shell', 'active', 'active sibling', 'hidden'])
  await Promise.all([hidden, activeSibling])
  await vi.runAllTimersAsync()
})

it('continues restoring after a failed start', async () => {
  vi.useFakeTimers()
  const queue = new RestoreAgentStartQueue()
  const failed = queue.run(
    'claude',
    () => true,
    async () => {
      throw new Error('spawn failed')
    }
  )
  const failure = expect(failed).rejects.toThrow('spawn failed')
  const next = vi.fn(async () => 'pty-next')
  const restored = queue.run('codex', () => false, next)
  await vi.advanceTimersByTimeAsync(0)
  await failure
  expect(next).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(150)
  await expect(restored).resolves.toBe('pty-next')
  await vi.runAllTimersAsync()
})
