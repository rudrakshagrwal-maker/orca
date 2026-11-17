// RA: one PTY's input is a sequence of whole transactions. A prompt paste, its settle wait and its first
// Enter hold the PTY, so human typing or another agent's raw send cannot land inside it. Ctrl+C, Escape
// and terminal query replies never wait (isInputTransactionBypass).
const heldTails = new Map<string, Promise<void>>()
const heldCounts = new Map<string, number>()
const deferredTails = new Map<string, Promise<void>>()

export function isPtyInputTransactionHeld(ptyId: string): boolean {
  return (heldCounts.get(ptyId) ?? 0) > 0
}

// A terminal's own answer to a query, matched by shape (whole payload, one or more replies):
// CSI cursor report `row;col R`, DA `? > ... c`, DSR `[?]n n`, DECRPM `? n;n $ y`, and OSC color/palette
// replies `10|11|12|4;..;rgb:` ended by BEL or ST. Anything else, including arrow keys, waits.
// oxlint-disable-next-line no-control-regex -- the shapes are escape sequences.
const TERMINAL_REPLY_ONLY =
  /^(?:\x1b\[\d+;\d+R|\x1b\[[?>][\d;]*c|\x1b\[\??\d+(?:;\d+)*n|\x1b\[\?\d+;\d+\$y|\x1b\](?:1[012]|4;\d+);rgb:[0-9a-fA-F/]+(?:\x07|\x1b\\))+$/

/** Input that must stay instant: interrupt, cancel, and the terminal's own answers to queries. */
export function isInputTransactionBypass(data: string, inputKind?: string): boolean {
  return (
    inputKind === 'query-reply' ||
    data.includes('\x03') ||
    data === '\x1b' ||
    TERMINAL_REPLY_ONLY.test(data)
  )
}

/** Resolves with a release function once every earlier transaction on `ptyId` has finished. */
export async function acquirePtyInputTransaction(
  ptyId: string,
  signal?: AbortSignal
): Promise<() => void> {
  if (signal?.aborted) {
    throw new Error('request_aborted')
  }
  const previous = heldTails.get(ptyId) ?? Promise.resolve()
  let finish!: () => void
  const tail = new Promise<void>((resolve) => {
    finish = resolve
  })
  heldTails.set(ptyId, tail)
  heldCounts.set(ptyId, (heldCounts.get(ptyId) ?? 0) + 1)
  let released = false
  const release = (): void => {
    if (released) {
      return
    }
    released = true
    finish()
    const remaining = (heldCounts.get(ptyId) ?? 1) - 1
    if (remaining <= 0) {
      heldCounts.delete(ptyId)
      heldTails.delete(ptyId)
    } else {
      heldCounts.set(ptyId, remaining)
    }
  }
  try {
    await waitFor(previous, signal)
  } catch (error) {
    // Our slot passes the lock on only once the earlier holder is done, so later waiters keep their order.
    void previous.then(release, release)
    throw error
  }
  return release
}

/**
 * Runs `write` now when no transaction holds the PTY, otherwise after the holders finish, in arrival
 * order. The synchronous path is untouched, so idle typing keeps its current timing.
 */
export function writeAfterPtyInputTransaction<T>(
  ptyId: string,
  write: () => T | Promise<T>
): T | Promise<T> {
  if (!isPtyInputTransactionHeld(ptyId) && !deferredTails.has(ptyId)) {
    return write()
  }
  const previous = deferredTails.get(ptyId) ?? Promise.resolve()
  const run = (async (): Promise<T> => {
    await previous.catch(() => undefined)
    // A new transaction may have started while we waited; re-check so a write never lands inside it.
    while (isPtyInputTransactionHeld(ptyId)) {
      await (heldTails.get(ptyId) ?? Promise.resolve())
    }
    return await write()
  })()
  const tail = run.then(
    () => undefined,
    () => undefined
  )
  deferredTails.set(ptyId, tail)
  void tail.then(() => {
    if (deferredTails.get(ptyId) === tail) {
      deferredTails.delete(ptyId)
    }
  })
  return run
}

function waitFor(promise: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return promise
  }
  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => reject(new Error('request_aborted'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      () => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      },
      () => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      }
    )
  })
}
