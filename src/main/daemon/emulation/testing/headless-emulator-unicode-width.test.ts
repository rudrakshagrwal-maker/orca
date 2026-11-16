import { describe, expect, it } from 'vitest'
import { HeadlessEmulator } from '../headless-emulator'

describe('headless emulator unicode widths', () => {
  // RA: keep wcwidth-compatible Devanagari cells without a grapheme addon.
  it('preserves Hindi matra and virama widths when a TUI overwrites the following cell', async () => {
    const emulator = new HeadlessEmulator({ cols: 40, rows: 4 })
    try {
      await emulator.write('हिन्दीX\r\nक्षX')
      await emulator.write('\x1b[1;6HY\x1b[2;3HY')
      expect(emulator.getVisibleLines().slice(0, 2)).toEqual(['हिन्दीY', 'क्षY'])
    } finally {
      emulator.dispose()
    }
  })

  it('joins ZWJ emoji into one wide pair like the renderer provider', async () => {
    const emulator = new HeadlessEmulator({ cols: 40, rows: 4 })
    // ZWJ joining budgets this glyph as two cells; plain Unicode 11 budgets four.
    await emulator.write('\x1b[H\u{1F469}\u{200D}\u{1F4BB}X')
    await emulator.write('\x1b[1;3HY')
    expect(emulator.getVisibleLines()[0]).toBe('\u{1F469}\u{200D}\u{1F4BB}Y')
    emulator.dispose()
  })
})
