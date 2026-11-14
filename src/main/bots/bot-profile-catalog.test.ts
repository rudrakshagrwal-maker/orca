import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import Database from '../sqlite/sync-database'
import { readHermesChats } from './hermes-chat-reader'
import { readLocalBotProfiles } from './bot-profile-catalog'
import { buildBotLaunch } from './bot-launch-command'
import type { BotProfile } from '../../shared/bot-profile-types'

const roots: string[] = []
function home(): string {
  const root = mkdtempSync(join(tmpdir(), 'orca-bots-'))
  roots.push(root)
  return root
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function database(root: string, modern = true): string {
  const file = join(root, 'state.db')
  const db = new Database(file)
  db.exec(`CREATE TABLE sessions (id TEXT PRIMARY KEY, started_at REAL NOT NULL${modern ? ', title TEXT, last_activity_at REAL, hidden INTEGER DEFAULT 0, archived INTEGER DEFAULT 0, parent_session_id TEXT' : ''});
    CREATE TABLE messages (id INTEGER PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, timestamp REAL${modern ? ', active INTEGER DEFAULT 1' : ''});
    CREATE INDEX messages_session_time ON messages(session_id, timestamp);
    INSERT INTO sessions(id, started_at) VALUES ('older', 100), ('newest', 200);
    INSERT INTO messages(id, session_id, role, content, timestamp) VALUES
      (1, 'older', 'user', 'First question', 100),
      (2, 'newest', 'assistant', 'Latest answer', 210),
      (3, 'newest', 'tool', 'Hidden tool output', 220);`)
  if (modern) {
    db.exec(`UPDATE sessions SET title='Named chat', last_activity_at=230 WHERE id='newest';
    INSERT INTO sessions(id, started_at, hidden) VALUES ('hidden', 400, 1);
    INSERT INTO sessions(id, started_at, archived) VALUES ('archived', 500, 1);
    INSERT INTO sessions(id, started_at, parent_session_id) VALUES ('child', 600, 'newest');
    INSERT INTO messages(id, session_id, role, content, timestamp, active) VALUES (4, 'newest', 'assistant', 'Rewound answer', 240, 0);`)
  }
  db.close()
  return file
}

describe('local Hermes chat reader', () => {
  it('maps real schema columns, hides internal chats and leaves the database unchanged', () => {
    const file = database(home())
    const before = readFileSync(file)
    expect(readHermesChats(file)).toEqual([
      { id: 'newest', title: 'Named chat', preview: 'Latest answer', updatedAt: 230000 },
      { id: 'older', title: 'First question', preview: 'First question', updatedAt: 100000 }
    ])
    expect(readFileSync(file)).toEqual(before)
  })
  it('reads older schemas without optional title, activity and visibility columns', () => {
    expect(readHermesChats(database(home(), false))).toEqual([
      { id: 'newest', title: 'Latest answer', preview: 'Latest answer', updatedAt: 210000 },
      { id: 'older', title: 'First question', preview: 'First question', updatedAt: 100000 }
    ])
  })
  it('extracts text blocks without exposing JSON or image data', () => {
    const file = database(home())
    const db = new Database(file)
    db.prepare('UPDATE messages SET content=? WHERE id=2').run(
      '[{"type":"text","text":"One\\nline"},{"type":"image_url","image_url":{"url":"private"}}]'
    )
    db.close()
    expect(readHermesChats(file)[0]?.preview).toBe('One line')
  })
  it('does not create a missing database', () => {
    const file = join(home(), 'missing.db')
    expect(() => readHermesChats(file)).toThrow()
    expect(existsSync(file)).toBe(false)
  })
  it('reports missing Hermes without materializing a home or database', async () => {
    const missing = join(home(), 'not-installed')
    expect(await readLocalBotProfiles(missing)).toEqual({
      profiles: [],
      installed: false,
      lastSuccess: expect.any(Number)
    })
    expect(existsSync(missing)).toBe(false)
  })
  it('lists default and live local profiles, skipping ghost and tombstoned directories', async () => {
    const root = home()
    database(root)
    for (const name of ['writer', 'ghost', 'deleted', '.deleted/deleted']) {
      mkdirSync(join(root, 'profiles', name), { recursive: true })
    }
    writeFileSync(join(root, 'profiles', 'writer', 'profile.yaml'), 'display_name: Writer Bot\n')
    writeFileSync(join(root, 'profiles', 'deleted', 'profile.yaml'), 'display_name: Deleted\n')
    const result = await readLocalBotProfiles(root)
    expect(
      result.profiles.map((profile) => [profile.id, profile.label, profile.application])
    ).toEqual([
      ['default', 'Hermes', 'local TUI'],
      ['writer', 'Writer Bot', 'local TUI']
    ])
    expect(result.profiles[0]?.chats?.[0]?.id).toBe('newest')
    expect(result.profiles[1]?.chats).toEqual([])
    expect(existsSync(join(root, 'profiles', 'writer', 'state.db'))).toBe(false)
  })
  it('isolates a bad profile database while keeping healthy profiles usable', async () => {
    const root = home()
    database(root)
    mkdirSync(join(root, 'profiles', 'broken'), { recursive: true })
    writeFileSync(join(root, 'profiles', 'broken', 'state.db'), 'not a database')
    const result = await readLocalBotProfiles(root)
    expect(result.profiles[0]?.chats?.[0]?.id).toBe('newest')
    expect(result.profiles[1]?.error).toBeTruthy()
  })
})

const profile: BotProfile = {
  key: 'hermes:local:writer',
  id: 'writer',
  label: 'Writer',
  source: 'hermes',
  application: 'local TUI',
  home: '/local/hermes/profiles/writer',
  chats: [
    { id: 'newest', title: 'Current', preview: 'Hi', updatedAt: 200 },
    { id: 'older', title: 'Earlier', preview: 'Hello', updatedAt: 100 }
  ]
}
describe('bot launch selection', () => {
  it('resumes the latest chat, an explicit chat, or starts fresh', () => {
    expect(buildBotLaunch(profile)).toEqual({
      label: 'Writer',
      agentArgs: '-p writer --tui --resume newest'
    })
    expect(buildBotLaunch(profile, 'older').agentArgs).toBe('-p writer --tui --resume older')
    expect(buildBotLaunch(profile, null).agentArgs).toBe('-p writer --tui')
    expect(buildBotLaunch({ ...profile, chats: [] }).agentArgs).toBe('-p writer --tui')
  })
  it.each(['unknown', 'x;whoami', '-latest'])('rejects unowned or unsafe session %s', (session) => {
    expect(() => buildBotLaunch(profile, session)).toThrow()
  })
  it('rejects remote catalogue identities and unsafe profiles', () => {
    expect(() => buildBotLaunch({ ...profile, application: 'remote TUI' })).toThrow()
    expect(() => buildBotLaunch({ ...profile, id: '../default' })).toThrow()
  })
  it('does not silently start fresh when history is unreadable', () => {
    expect(() => buildBotLaunch({ ...profile, chats: [], error: 'Database busy' })).toThrow(
      'Database busy'
    )
    expect(buildBotLaunch({ ...profile, chats: [], error: 'Database busy' }, null).agentArgs).toBe(
      '-p writer --tui'
    )
  })
})
