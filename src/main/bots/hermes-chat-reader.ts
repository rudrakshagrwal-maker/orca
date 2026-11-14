import SyncDatabase from '../sqlite/sync-database'
import type { BotChat } from '../../shared/bot-profile-types'
import {
  extractPreviewContentText,
  normalizeTitleText
} from '../ai-vault/session-scanner-text-normalization'

export const validSessionId = (id: string): boolean =>
  /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/.test(id)

function columns(db: SyncDatabase, table: 'sessions' | 'messages'): Set<string> {
  return new Set(
    db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((row) => String(row.name))
  )
}

function preview(content: unknown, role: unknown): string {
  if (typeof content !== 'string') {
    return ''
  }
  let value: unknown = content
  if (/^\s*\[\s*[{"]/.test(content)) {
    try {
      value = JSON.parse(content)
    } catch {
      return ''
    }
  }
  return extractPreviewContentText(value, typeof role === 'string' ? role : undefined) ?? ''
}

export function readHermesChats(dbPath: string): BotChat[] {
  const db = new SyncDatabase(dbPath, { readonly: true, fileMustExist: true, timeout: 50 })
  try {
    const sessions = columns(db, 'sessions')
    const messages = columns(db, 'messages')
    if (
      !['id', 'started_at'].every((key) => sessions.has(key)) ||
      !['id', 'session_id', 'role', 'content', 'timestamp'].every((key) => messages.has(key))
    ) {
      throw new Error('Unsupported Hermes chat schema')
    }
    const activity = sessions.has('last_activity_at')
      ? 'COALESCE(last_activity_at, started_at)'
      : 'started_at'
    const filters = [
      sessions.has('hidden') ? 'COALESCE(hidden, 0) = 0' : '',
      sessions.has('archived') ? 'COALESCE(archived, 0) = 0' : '',
      sessions.has('parent_session_id') ? 'parent_session_id IS NULL' : ''
    ].filter(Boolean)
    const rows = db
      .prepare(`SELECT id, ${sessions.has('title') ? 'title' : 'NULL AS title'},
      ${activity} AS activity FROM sessions ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ORDER BY ${activity} DESC, started_at DESC LIMIT 20`)
      .all()
    const lastMessage =
      db.prepare(`SELECT substr(content, 1, 4096) AS content, role, timestamp FROM messages
      WHERE session_id = ? AND role IN ('user', 'assistant') AND content IS NOT NULL AND content != ''
      ${messages.has('active') ? 'AND (active = 1 OR active IS NULL)' : ''}
      ORDER BY timestamp DESC, id DESC LIMIT 1`)
    return rows
      .flatMap((row) => {
        if (typeof row.id !== 'string' || !validSessionId(row.id)) {
          return []
        }
        const message = lastMessage.get(row.id)
        const text = preview(message?.content, message?.role)
        const seconds = Math.max(Number(row.activity) || 0, Number(message?.timestamp) || 0)
        return [
          {
            id: row.id,
            title:
              typeof row.title === 'string'
                ? normalizeTitleText(row.title) || text || 'Untitled chat'
                : text || 'Untitled chat',
            preview: text,
            updatedAt: seconds * 1000
          }
        ]
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } finally {
    db.close()
  }
}
