import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it} from 'vitest'

import { RelayDispatcher } from '../../../wsl-guest/dispatcher'
import { registerWslHookFsHandlers } from '../../../wsl-guest/wsl-hook-fs-bridge'
import { SshChannelMultiplexer } from '../../ssh/protocol/ssh-channel-multiplexer'
import type { MultiplexerTransport } from '../../ssh/protocol/ssh-multiplexer-transport-writer'
import { createWslHookSftpAdapter } from './wsl-hook-fs-adapter'

type GuestHarness = {
  transport: MultiplexerTransport
  guestDispatcher: RelayDispatcher
  mux: SshChannelMultiplexer
}

/** Connect a host mux to a guest dispatcher through in-memory stdio. */
function createGuestHarness(): GuestHarness {
  let relayFeed: ((data: Buffer) => void) | undefined
  const clientDataCallbacks: ((data: Buffer) => void)[] = []
  const closeCallbacks: (() => void)[] = []
  const transport: MultiplexerTransport = {
    write: (data, onSettled) => {
      setImmediate(() => {
        relayFeed?.(data)
        onSettled?.({ ok: true })
      })
    },
    supportsWriteSettlement: true,
    onData: (cb) => {
      clientDataCallbacks.push(cb)
    },
    onClose: (cb) => {
      closeCallbacks.push(cb)
    }
  }
  const guestDispatcher = new RelayDispatcher(
    (data: Buffer, onSettled) => {
      setImmediate(() => {
        for (const cb of clientDataCallbacks) {
          cb(data)
        }
        onSettled({ ok: true })
      })
    },
    { supportsWriteCallback: true }
  )
  relayFeed = (data) => guestDispatcher.feed(data)
  const mux = new SshChannelMultiplexer(transport)
  return { transport, guestDispatcher, mux }
}

// The filesystem bridge executes inside a POSIX guest.
describe.skipIf(process.platform === 'win32')(
  'createWslHookSftpAdapter over the guest fs bridge',
  () => {
    let home: string
    let harness: GuestHarness

    beforeEach(() => {
      home = mkdtempSync(join('/tmp', 'wsl-guest-home-'))
      harness = createGuestHarness()
      registerWslHookFsHandlers(harness.guestDispatcher, home)
    })

    afterEach(() => {
      harness.mux.dispose()
      harness.guestDispatcher.dispose()
      rmSync(home, { recursive: true, force: true })
    })

    it('round-trips write/read/rename and rejects paths outside home', async () => {
      const adapter = createWslHookSftpAdapter(harness.mux)
      await new Promise<void>((resolve, reject) => {
        adapter.writeFile(
          `${home}/a.txt`,
          'hello',
          { encoding: 'utf8', mode: 0o600 } as never,
          ((e: Error | null) => (e ? reject(e) : resolve())) as never
        )
      })
      const content = await new Promise<string>((resolve, reject) => {
        adapter.readFile(`${home}/a.txt`, 'utf8', ((e: Error | null, value: string) =>
          e ? reject(e) : resolve(value)) as never)
      })
      expect(content).toBe('hello')

      await new Promise<void>((resolve, reject) => {
        adapter.ext_openssh_rename(`${home}/a.txt`, `${home}/b.txt`, ((e: Error | null) =>
          e ? reject(e) : resolve()) as never)
      })
      expect(existsSync(`${home}/b.txt`)).toBe(true)

      const outside = await new Promise<Error & { code?: number }>((resolve) => {
        adapter.readFile('/etc/passwd', 'utf8', ((e: Error) => resolve(e)) as never)
      })
      expect(outside).toBeInstanceOf(Error)
    })
  }
)
