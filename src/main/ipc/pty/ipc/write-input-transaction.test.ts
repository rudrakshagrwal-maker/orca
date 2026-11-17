import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acquirePtyInputTransaction } from '../../../runtime/terminal/input/pty-input-transaction'
import { ptyOwnership } from '../provider/ownership-state'
import { createPtyWriteInput } from './write-input'

// RA: desktop typing queues behind a held input transaction; interrupts and replies bypass.
const PTY_ID = 'pty-transaction'

const { provider } = vi.hoisted(() => ({
  provider: { write: vi.fn(), hasPty: vi.fn(() => true), writeWithSettlement: vi.fn() }
}))

vi.mock('../provider/registry', () => ({
  tryGetProviderForPty: (id: string) => (id === PTY_ID ? provider : undefined)
}))

function createWriteInput() {
  const runtime = {
    getDriver: () => ({ kind: 'desktop' }),
    terminalRunFacts: undefined,
    observeClaudeTerminalEvidence: vi.fn(),
    noteRemoteDesktopHostInput: vi.fn()
  }
  const mainWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stubs implement every runtime and window member this writer reads.
  return createPtyWriteInput({ mainWindow: mainWindow as never, runtime: runtime as never })
}

beforeEach(() => {
  ptyOwnership.set(PTY_ID, 'local')
  provider.write.mockReset()
})

afterEach(() => {
  ptyOwnership.delete(PTY_ID)
})

describe('desktop PTY writes during an input transaction', () => {
  it('queues typing in order behind a held prompt and writes it after release', async () => {
    const { writePtyInput } = createWriteInput()
    const release = await acquirePtyInputTransaction(PTY_ID)

    const typed = [
      writePtyInput({ id: PTY_ID, data: 'h', inputKind: 'driving' }),
      writePtyInput({ id: PTY_ID, data: 'i', inputKind: 'driving' })
    ]
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(provider.write).not.toHaveBeenCalled()

    release()
    await expect(Promise.all(typed)).resolves.toEqual([true, true])
    expect(provider.write.mock.calls.map((call) => call[1])).toEqual(['h', 'i'])
  })

  it('lets Ctrl+C, Escape and query replies through while the prompt is held', async () => {
    const { writePtyInput } = createWriteInput()
    const release = await acquirePtyInputTransaction(PTY_ID)

    expect(writePtyInput({ id: PTY_ID, data: '\x03', inputKind: 'driving' })).toBe(true)
    expect(writePtyInput({ id: PTY_ID, data: '\x1b', inputKind: 'driving' })).toBe(true)
    expect(writePtyInput({ id: PTY_ID, data: '\x1b[1;1R', inputKind: 'query-reply' })).toBe(true)
    expect(provider.write.mock.calls.map((call) => call[1])).toEqual(['\x03', '\x1b', '\x1b[1;1R'])
    release()
  })

  it('lets a terminal reply through even when labelled driving', async () => {
    const { writePtyInput } = createWriteInput()
    const release = await acquirePtyInputTransaction(PTY_ID)
    expect(writePtyInput({ id: PTY_ID, data: '\x1b[12;40R', inputKind: 'driving' })).toBe(true)
    expect(provider.write).toHaveBeenCalledOnce()
    release()
  })

  it('writes synchronously when nothing holds the PTY', () => {
    const { writePtyInput } = createWriteInput()
    expect(writePtyInput({ id: PTY_ID, data: 'a', inputKind: 'driving' })).toBe(true)
    expect(provider.write).toHaveBeenCalledOnce()
  })
})
