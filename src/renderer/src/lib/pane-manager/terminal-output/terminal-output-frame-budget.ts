// RA: reserve at most 48 KiB UTF-8 and 8 ms across panes, including async parser work.
export const TERMINAL_FRAME_CHARS = 16 * 1024
export const TERMINAL_PANE_FRAME_CHARS = 4 * 1024
export const TERMINAL_FRAME_MS = 8
export const TERMINAL_MIN_MS_PER_CHAR = TERMINAL_FRAME_MS / TERMINAL_FRAME_CHARS

export function planTerminalOutputFrame<T>(
  panes: readonly { pane: T; queuedChars: number; msPerChar: number }[],
  elapsedMs = 0
): { pane: T; maxChars: number }[] {
  let remainingChars = TERMINAL_FRAME_CHARS
  let remainingMs = Math.max(0, TERMINAL_FRAME_MS - elapsedMs)
  const writes: { pane: T; maxChars: number }[] = []
  for (const { pane, queuedChars, msPerChar } of panes) {
    const cost = Math.max(TERMINAL_MIN_MS_PER_CHAR, msPerChar)
    const maxChars = Math.min(
      queuedChars,
      TERMINAL_PANE_FRAME_CHARS,
      remainingChars,
      Math.floor(remainingMs / cost)
    )
    if (maxChars <= 0 || maxChars < Math.min(2, queuedChars)) {
      continue
    }
    writes.push({ pane, maxChars })
    remainingChars -= maxChars
    remainingMs -= maxChars * cost
  }
  return writes
}
