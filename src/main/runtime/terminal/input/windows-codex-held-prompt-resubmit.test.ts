import type * as WorktreeScanCacheModule from '../../../git/worktrees/catalog/worktree-scan-cache'
import type * as WorktreeListingModule from '../../../git/worktrees/catalog/worktree-listing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAgentPromptSubmissionRuntime } from './agent-prompt-submission-runtime-test-fixture'
import { acquirePtyInputTransaction, writeAfterPtyInputTransaction } from './pty-input-transaction'

vi.mock('../../../git/worktrees/catalog/worktree-scan-cache', async (importOriginal) => {
  const facade = getWorktreeListingMocks()
  return {
    ...(await importOriginal<typeof WorktreeScanCacheModule>()),
    listWorktrees: facade.listWorktrees
  }
})

vi.mock('../../../git/worktrees/catalog/worktree-listing', async (importOriginal) => {
  const facade = getWorktreeListingMocks()
  return {
    ...(await importOriginal<typeof WorktreeListingModule>()),
    listWorktreesStrict: facade.listWorktreesStrict
  }
})

const { getWorktreeListingMocks } = vi.hoisted(() => {
  const createWorktreeListingMocks = () => ({
    listWorktrees: vi.fn().mockResolvedValue([
      {
        path: '/tmp/worktree-a',
        head: 'abc',
        branch: 'feature/prompt-verification',
        isBare: false,
        isMainWorktree: false
      }
    ]),
    listWorktreesStrict: vi.fn().mockResolvedValue([
      {
        path: '/tmp/worktree-a',
        head: 'abc',
        branch: 'feature/prompt-verification',
        isBare: false,
        isMainWorktree: false
      }
    ])
  })
  let listings: ReturnType<typeof createWorktreeListingMocks> | undefined
  return { getWorktreeListingMocks: () => (listings ??= createWorktreeListingMocks()) }
})

describe('a Windows Codex prompt held in its paste burst', () => {
  afterEach(() => vi.useRealTimers())

  it.each([
    { change: 'the user types beside the held paste', draft: '[Pasted Content 9250 chars] and x' },
    { change: 'the held window runs out', draft: '[Pasted Content 9250 chars]', lateMs: 60_000 }
  ])('decides the Windows Codex retry again after its write guard when $change', async (c) => {
    vi.useFakeTimers()
    let draft = '[Pasted Content 9250 chars]'
    let guards = 0
    const { runtime, handle, writes } = await createAgentPromptSubmissionRuntime(
      () => undefined,
      'codex'
    )
    Object.defineProperty(runtime, 'getPtyWriteHostPlatform', { value: () => 'win32' })
    Object.defineProperty(runtime, 'readCurrentTerminalWaitScreen', {
      value: async () => ({ lines: [], draft })
    })

    const submission = runtime.sendTerminalAgentPrompt(handle, 'x'.repeat(9_250), {
      inputKind: 'driving',
      acceptQueued: true,
      requestId: 'windows-codex-guard',
      observationTimeoutMs: 0,
      // Paste, first Enter, then the retry's guard, which yields while the screen moves on.
      beforeWrite: async () => {
        guards += 1
        if (guards === 3) {
          draft = c.draft
          vi.setSystemTime(Date.now() + (c.lateMs ?? 0))
        }
      }
    })
    await vi.runAllTimersAsync()

    await expect(submission).resolves.toMatchObject({ accepted: true })
    expect(guards).toBe(3)
    expect(writes.filter((write) => write === '\r')).toHaveLength(1)
  })

  it('does not press Enter into a Windows Codex composer showing a rotating placeholder', async () => {
    vi.useFakeTimers()
    const { runtime, handle, writes } = await createAgentPromptSubmissionRuntime(
      () => undefined,
      'codex'
    )
    Object.defineProperty(runtime, 'getPtyWriteHostPlatform', { value: () => 'win32' })
    // Codex 0.162 after taking a prompt: bold glyph, dim rotating placeholder, dim model footer.
    runtime.onPtyData(
      'pty-prompt',
      '\x1b[2J\x1b[H\x1b[1m›\x1b[22m \x1b7\x1b[2mExplain this codebase\x1b[22m\r\n\r\n\x1b[2m  gpt-5.1 default · ~/repo\x1b[22m\x1b8',
      Date.now()
    )

    const submission = runtime.sendTerminalAgentPrompt(handle, 'x'.repeat(9_250), {
      inputKind: 'driving',
      acceptQueued: true,
      requestId: 'windows-codex-placeholder',
      observationTimeoutMs: 0
    })
    await vi.runAllTimersAsync()

    await expect(submission).resolves.toMatchObject({ accepted: true })
    expect((await runtime['readCurrentTerminalWaitScreen']('pty-prompt'))?.draft).toBeUndefined()
    expect(writes.filter((write) => write === '\r')).toHaveLength(1)
  })
})

// RA: deterministic paste boundary and prompt-wide input transaction for the owned prompt path.
describe('an owned prompt on Windows Codex', () => {
  afterEach(() => vi.useRealTimers())

  // RA: the boundary key needs Codex's composer on screen; a PowerShell prompt must not get it.
  const CODEX_SCREEN = '\x1b[2J\x1b[H› Ask Codex to do anything\r\n\r\n  gpt-5.1 default · ~/repo'
  const SHELL_SCREEN = '\x1b[2J\x1b[HPS C:\\repo> '

  async function sendPrompt(
    platform: NodeJS.Platform,
    type?: (writes: string[]) => void,
    screen = CODEX_SCREEN
  ) {
    vi.useFakeTimers()
    const { runtime, handle, writes } = await createAgentPromptSubmissionRuntime(
      () => undefined,
      'codex'
    )
    Object.defineProperty(runtime, 'getPtyWriteHostPlatform', { value: () => platform })
    runtime.onPtyData('pty-prompt', screen, Date.now())
    const submission = runtime.sendTerminalAgentPrompt(handle, 'x'.repeat(9_250), {
      inputKind: 'driving',
      acceptQueued: true,
      requestId: `boundary-${platform}`,
      observationTimeoutMs: 0
    })
    if (type) {
      await vi.advanceTimersByTimeAsync(50)
      type(writes)
    }
    await vi.runAllTimersAsync()
    await expect(submission).resolves.toMatchObject({ accepted: true })
    return writes
  }

  it('sends Right between the paste and its first Enter', async () => {
    const writes = await sendPrompt('win32')
    const paste = writes.findIndex((write) => write.includes('\x1b[200~'))
    const right = writes.indexOf('\x1b[C')
    const enter = writes.indexOf('\r')
    expect(paste).toBe(0)
    expect(right).toBeGreaterThan(paste)
    expect(enter).toBeGreaterThan(right)
  })

  it('sends no boundary key when the pane is back at a shell prompt', async () => {
    expect(await sendPrompt('win32', undefined, SHELL_SCREEN)).not.toContain('\x1b[C')
  })

  it('sends no boundary key off Windows', async () => {
    expect(await sendPrompt('darwin')).not.toContain('\x1b[C')
  })

  it('holds desktop typing until the first Enter has gone out, then lets it through', async () => {
    const order: string[] = []
    const writes = await sendPrompt('win32', (written) => {
      void writeAfterPtyInputTransaction('pty-prompt', () => {
        order.push(`typed after ${written.filter((write) => write === '\r').length} Enters`)
        written.push('typed')
      })
      void writeAfterPtyInputTransaction('pty-prompt', () => {
        // Query replies and Ctrl+C never enter this path; ordinary writes keep their order.
        written.push('typed-2')
      })
    })
    expect(order).toEqual(['typed after 1 Enters'])
    expect(writes.indexOf('typed')).toBeGreaterThan(writes.indexOf('\r'))
    expect(writes.indexOf('typed-2')).toBe(writes.indexOf('typed') + 1)
  })
})

// RA: the held-prompt retry Enter goes through the input transaction too.
describe('a held Windows Codex prompt retry', () => {
  afterEach(() => vi.useRealTimers())

  it('does not press its retry Enter while someone else holds the PTY', async () => {
    vi.useFakeTimers()
    let release: (() => void) | undefined
    const { runtime, handle, writes } = await createAgentPromptSubmissionRuntime(
      (_runtime, data) => {
        if (data === '\r' && !release) {
          // Another sender takes the PTY right after the first Enter.
          void acquirePtyInputTransaction('pty-prompt').then((r) => (release = r))
        }
      },
      'codex'
    )
    Object.defineProperty(runtime, 'getPtyWriteHostPlatform', { value: () => 'win32' })
    Object.defineProperty(runtime, 'readCurrentTerminalWaitScreen', {
      value: async () => ({ lines: [], draft: '[Pasted Content 9250 chars]' })
    })
    const submission = runtime.sendTerminalAgentPrompt(handle, 'x'.repeat(9_250), {
      inputKind: 'driving',
      acceptQueued: true,
      requestId: 'retry-transaction',
      observationTimeoutMs: 0
    })
    await vi.advanceTimersByTimeAsync(20_000)
    expect(writes.filter((write) => write === '\r')).toHaveLength(1)

    release?.()
    await vi.runAllTimersAsync()
    await expect(submission).resolves.toMatchObject({ accepted: true })
  })
})
