// RA: One bounded SSH refresh, no profile switches, gateway polling or model requests.
import { app } from 'electron'
import { runProcess } from '@orca/process-host'
import { readFile, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { AtomicSnapshotWriter } from '../persistence/atomic-snapshot-writer'
import type { BotProfile, BotProfileSnapshot } from '../../shared/bot-profile-types'

export const HERMES_HOST = 'hermes@100.65.84.89'
export const HERMES_KEY = 'C:\\Users\\Rudraksh\\.ssh\\hetzner'
export const HERMES_SSH_ARGS = ['-i', HERMES_KEY, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=yes', HERMES_HOST]
export const DSH_HOMES = [process.env.DSH_HOME || path.join(homedir(), '.dsh'), 'C:\\Users\\Rudraksh\\Documents\\Workspace\\Projects\\Harness\\.dsh-ra-dev']
export const validBotId = (id: string): boolean => /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(id)

export function parseHermesProfiles(output: string): BotProfile[] {
  const clean = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
  if (!/^[ \t]*Profile[ \t]+Model[ \t]+Gateway\b/m.test(clean)) throw new Error('Unknown Hermes profile table')
  const rows = clean.slice(clean.search(/^[ \t]*Profile[ \t]+Model[ \t]+Gateway\b/m)).split(/\r?\n/).slice(1).filter((line) => line.trim() && !/^[\s─━-]+$/.test(line))
  if (!rows.length) throw new Error('Hermes profile table has no recognized rows')
  const seen = new Set<string>()
  return rows.map((line) => {
    if (!/\s{2,}(?:running|stopped)\s{2,}/.test(line)) throw new Error('Unknown Hermes profile row')
    const id = line.trim().replace(/^[◆◇●*]\s*/, '').split(/\s+/)[0]
    if (!validBotId(id)) throw new Error('Invalid Hermes profile identity')
    if (seen.has(id)) throw new Error('Duplicate Hermes profile identity')
    seen.add(id)
    return { key: `hermes:${HERMES_HOST}:${id}`, id, label: `Hermes / ${id}`, source: 'hermes', home: '/home/hermes', application: 'remote TUI' }
  })
}

let snapshot: BotProfileSnapshot = { profiles: [], lastSuccess: null }
let loaded: Promise<void> | undefined
let refreshing: Promise<BotProfileSnapshot> | undefined
let writer: AtomicSnapshotWriter | undefined
const cachePath = () => path.join(app.getPath('userData'), 'bot-profiles-hermes-100.65.84.89.json')

async function load(): Promise<void> {
  loaded ??= (async () => {
    try {
      const saved = JSON.parse(await readFile(cachePath(), 'utf8')) as BotProfileSnapshot
      // Only Hermes IDs are restored; all command/home/source fields are reconstructed here.
      if (Array.isArray(saved.profiles) && typeof saved.lastSuccess === 'number') {
        snapshot = {
          profiles: saved.profiles.filter((p) => p.source === 'hermes' && validBotId(p.id)).map((p) => ({
            key: `hermes:${HERMES_HOST}:${p.id}`, id: p.id, label: `Hermes / ${p.id}`,
            source: 'hermes', home: '/home/hermes', application: 'remote TUI'
          })), lastSuccess: saved.lastSuccess
        }
      }
    } catch { /* First use or invalid cache. */ }
  })()
  await loaded
}

async function discoverDsh(): Promise<BotProfile[]> {
  const profiles: BotProfile[] = []
  for (const home of [...new Set(DSH_HOMES)]) {
    let children
    try { children = await readdir(path.join(home, 'profiles'), { withFileTypes: true }) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    for (const child of children) {
      if (!child.isDirectory() || !validBotId(child.name)) continue
      try { if (!(await stat(path.join(home, 'profiles', child.name, 'package.json'))).isFile()) continue }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw error
      }
      profiles.push({ key: `dsh:${home}:${child.name}`, id: child.name, label: `DSH / ${child.name}`, source: 'dsh', home,
        application: child.name === 'web' ? 'web host' : child.name === 'headless' ? 'headless' : 'unverified application' })
    }
  }
  return profiles
}

export async function getBotProfiles(refresh = false): Promise<BotProfileSnapshot> {
  await load()
  if (!refresh) {
    try { snapshot = { ...snapshot, profiles: [...snapshot.profiles.filter((p) => p.source === 'hermes'), ...await discoverDsh()] } }
    catch { snapshot = { ...snapshot, error: 'Could not read DSH profiles; showing saved entries.' } }
    return snapshot
  }
  refreshing ??= (async () => {
    try {
      if (process.platform !== 'win32') throw new Error('Hermes discovery requires this Windows desktop')
      const result = await runProcess({ program: 'ssh', args: [...HERMES_SSH_ARGS, '/home/hermes/.local/bin/hermes profile list'], timeoutMs: 20_000, maxOutputBytes: 64 * 1024 })
      if (result.code !== 0 || result.timedOut || result.outputTruncated || result.signal) throw new Error('Hermes SSH unavailable or incomplete; check Tailscale and SSH access')
      const profiles = [...parseHermesProfiles(result.stdout), ...await discoverDsh()]
      snapshot = { profiles, lastSuccess: Date.now() }
      writer ??= new AtomicSnapshotWriter(cachePath, { fileMode: 0o600, skipUnchanged: true })
      await writer.write(() => JSON.stringify({ lastSuccess: snapshot.lastSuccess, profiles: snapshot.profiles.filter((p) => p.source === 'hermes').map(({ id, label, source }) => ({ id, label, source })) })) // RA: no env, gateway state or credentials on disk.
    } catch (error) { snapshot = { ...snapshot, error: error instanceof Error ? error.message : 'Profile discovery failed' } }
    return snapshot
  })().finally(() => { refreshing = undefined })
  return refreshing
}
