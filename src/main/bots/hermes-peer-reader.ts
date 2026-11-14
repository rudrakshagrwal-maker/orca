import { runProcess } from '@orca/process-host'
import { z } from 'zod'
import type { BotProfileSnapshot, HermesPeer } from '../../shared/bot-profile-types'
import { hermesSshArgs } from './hermes-peer-transport'
import { findSystemSsh } from '../ssh/system-transport/system-ssh-binary'

// One read-only process and SSH connection per peer, bounded to twenty chats per profile.
export const HERMES_PEER_QUERY = String.raw`
import json, os, re, sqlite3
from pathlib import Path
root = Path(os.environ['HERMES_HOME'])
markers = ('config.yaml', '.env', 'SOUL.md', 'profile.yaml', 'auth.json', 'state.db')
identity = lambda p: any((p / m).is_file() for m in markers)
names = ['default'] if identity(root) else []
profiles = root / 'profiles'
if profiles.is_dir():
    names += sorted(p.name for p in profiles.iterdir() if p.is_dir() and p.name != 'default' and re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,63}', p.name) and not (profiles / '.deleted' / p.name).exists() and identity(p))
def text(value):
    if not isinstance(value, str): return ''
    if re.match(r'^\s*\[\s*[{\"]', value):
        try:
            blocks = json.loads(value)
            value = ' '.join(b.get('text', '') for b in blocks if isinstance(b, dict) and b.get('type') == 'text')
        except (ValueError, TypeError): return ''
    return ' '.join(value.split())[:240]
result = []
for name in names:
    home = root if name == 'default' else profiles / name
    item = dict(id=name, home=str(home), label='Hermes' if name == 'default' else name, chats=[])
    db = None
    try:
        meta = home / 'profile.yaml'
        if meta.is_file():
            try:
                import yaml
                data = yaml.safe_load(meta.read_text()) or {}
                label = ((data.get('ui_meta') or {}).get('hermes-bots') or {}).get('title') or data.get('display_name')
                if isinstance(label, str) and label.strip(): item['label'] = label.strip()[:96]
            except Exception: pass
        if (home / 'state.db').is_file():
            db = sqlite3.connect((home / 'state.db').as_uri() + '?mode=ro', uri=True, timeout=0.05)
            db.execute('PRAGMA query_only=ON')
            s = {r[1] for r in db.execute('PRAGMA table_info(sessions)')}
            m = {r[1] for r in db.execute('PRAGMA table_info(messages)')}
            if not {'id','started_at'} <= s or not {'id','session_id','role','content','timestamp'} <= m: raise ValueError('schema')
            activity = 'COALESCE(last_activity_at, started_at)' if 'last_activity_at' in s else 'started_at'
            filters = [f'COALESCE({f},0)=0' for f in ('hidden','archived') if f in s]
            if 'parent_session_id' in s: filters.append('parent_session_id IS NULL')
            title = 'title' if 'title' in s else 'NULL'
            where = ' WHERE ' + ' AND '.join(filters) if filters else ''
            for sid, title, stamp in db.execute(f'SELECT id,{title},{activity} FROM sessions{where} ORDER BY {activity} DESC, started_at DESC LIMIT 20'):
                if not isinstance(sid,str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}',sid): continue
                active = ' AND (active=1 OR active IS NULL)' if 'active' in m else ''
                msg = db.execute("SELECT substr(content,1,4096),timestamp FROM messages WHERE session_id=? AND role IN ('user','assistant') AND content IS NOT NULL AND content!=''" + active + ' ORDER BY timestamp DESC,id DESC LIMIT 1',(sid,)).fetchone()
                preview = text(msg[0]) if msg else ''
                item['chats'].append(dict(id=sid,title=text(title) or preview or 'Untitled chat',preview=preview,updatedAt=max(stamp or 0,msg[1] or 0 if msg else 0)*1000))
            item['chats'].sort(key=lambda c:c['updatedAt'], reverse=True)
    except Exception:
        item['error'] = 'Could not read chats. Retry Refresh.'
    finally:
        if db is not None: db.close()
    result.append(item)
print(json.dumps(result))
`

const profileSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  home: z.string().max(4096),
  label: z.string().max(96),
  error: z.string().optional(),
  chats: z
    .array(
      z.object({
        id: z.string().max(256),
        title: z.string().max(240),
        preview: z.string().max(240),
        updatedAt: z.number().finite().nonnegative()
      })
    )
    .max(20)
})

export async function readPeerBotProfiles(peer: HermesPeer): Promise<BotProfileSnapshot> {
  try {
    const program = findSystemSsh()
    if (!program) {
      throw new Error('OpenSSH missing')
    }
    const result = await runProcess({
      program,
      args: hermesSshArgs(peer, ['/opt/hermes/venv/bin/python', '-B', '-']),
      input: HERMES_PEER_QUERY,
      timeoutMs: 8_000,
      maxOutputBytes: 2 * 1024 * 1024
    })
    if (result.code !== 0) {
      throw new Error('SSH failed')
    }
    const profiles = z.array(profileSchema).max(256).parse(JSON.parse(result.stdout))
    return {
      profiles: profiles.map((profile) => ({
        ...profile,
        key: `${peer.name}:${profile.id}`,
        host: peer.name,
        source: 'hermes',
        application: 'remote TUI'
      })),
      lastSuccess: Date.now()
    }
  } catch {
    return { profiles: [], lastSuccess: null, error: 'Unreachable. Check SSH or Refresh.' }
  }
}
