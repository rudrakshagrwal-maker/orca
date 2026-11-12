import { expect, it, vi } from 'vitest'
const files = vi.hoisted(() => new Map<string, string>())
vi.mock('../../native-chat/wsl-transcript-fs-access', () => ({
  wslGatedStat: async (path: string) => ({
    isFile: () => true,
    size: Buffer.byteLength(files.get(path) ?? '')
  }),
  readTranscriptSlice: async (path: string, start: number, length: number) =>
    Buffer.from(files.get(path) ?? '').subarray(start, start + length)
}))
vi.mock('../scanners/codex/session-scanner-codex-title-index', () => ({
  readCodexSessionIndexTitle: async () => 'Codex session'
}))
import { readStatusSessionTitles } from './status-session-title-reader'

// RA: exercise provider names without invoking the history scanner or retaining conversation messages.
it('uses the latest custom name over AI names and ignores foreign sessions and torn writes', async () => {
  files.set(
    'claude.jsonl',
    `${[
      { type: 'custom-title', sessionId: 'session', customTitle: 'Old name' },
      { type: 'custom-title', sessionId: 'session', customTitle: 'Current name' },
      { type: 'ai-title', sessionId: 'session', aiTitle: 'Generated name' },
      { type: 'custom-title', sessionId: 'foreign', customTitle: 'Wrong name' }
    ]
      .map((row) => JSON.stringify(row))
      .join('\n')}\n{"type":"custom-title"`
  )
  expect(
    await readStatusSessionTitles([
      { agent: 'claude', sessionId: 'session', transcriptPath: 'claude.jsonl' },
      { agent: 'codex', sessionId: 'codex-session', transcriptPath: 'codex.jsonl' }
    ])
  ).toEqual({
    titles: [
      { agent: 'claude', sessionId: 'session', title: 'Current name', kind: 'named' },
      { agent: 'codex', sessionId: 'codex-session', title: 'Codex session', kind: 'named' }
    ]
  })
})

it('accepts provider AI names without turning conversation content into a title', async () => {
  files.set('claude.jsonl', '{"type":"ai-title","sessionId":"session","aiTitle":"Live name"}\n')
  expect(
    (
      await readStatusSessionTitles([
        { agent: 'claude', sessionId: 'session', transcriptPath: 'claude.jsonl' }
      ])
    ).titles[0]?.title
  ).toBe('Live name')
  files.set('claude.jsonl', '{"type":"assistant","message":"Not a session title"}\n')
  expect(
    await readStatusSessionTitles([
      { agent: 'claude', sessionId: 'session', transcriptPath: 'claude.jsonl' }
    ])
  ).toEqual({ titles: [] })
})
