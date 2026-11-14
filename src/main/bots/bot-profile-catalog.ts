import { existsSync, lstatSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'yaml'
import { getHermesHome } from '../hermes/hermes-default-home'
import { readHermesChats } from './hermes-chat-reader'
import type { BotProfile, BotProfileSnapshot, HermesPeer } from '../../shared/bot-profile-types'
import { readPeerBotProfiles } from './hermes-peer-reader'

export const validBotId = (id: string): boolean => /^[a-z0-9][a-z0-9_-]{0,63}$/.test(id)
const IDENTITY_MARKERS = ['config.yaml', '.env', 'SOUL.md', 'profile.yaml', 'auth.json', 'state.db']
const hasIdentity = (home: string): boolean =>
  IDENTITY_MARKERS.some((name) => {
    const marker = lstatSync(path.join(home, name), { throwIfNoEntry: false })
    return marker?.isFile() || marker?.isSymbolicLink()
  })

async function profileLabel(home: string, id: string): Promise<string> {
  try {
    const metadata = parse(await readFile(path.join(home, 'profile.yaml'), 'utf8'))
    const title: unknown = metadata?.ui_meta?.['hermes-bots']?.title ?? metadata?.display_name
    if (typeof title === 'string' && title.trim()) {
      return title.trim().slice(0, 96)
    }
  } catch {
    /* Metadata is optional; a broken label must not hide the bot. */
  }
  return id === 'default' ? 'Hermes' : id
}

// Local discovery mirrors Hermes list_profile_names; remote peers can supply their own catalogue later.
export async function readLocalBotProfiles(home = getHermesHome()): Promise<BotProfileSnapshot> {
  if (!hasIdentity(home)) {
    return { profiles: [], installed: false, lastSuccess: Date.now() }
  }
  const names = ['default']
  const profilesRoot = path.join(home, 'profiles')
  let error: string | undefined
  try {
    for (const entry of await readdir(profilesRoot, { withFileTypes: true })) {
      if (
        (entry.isDirectory() || entry.isSymbolicLink()) &&
        entry.name !== 'default' &&
        validBotId(entry.name) &&
        !existsSync(path.join(profilesRoot, '.deleted', entry.name)) &&
        hasIdentity(path.join(profilesRoot, entry.name))
      ) {
        names.push(entry.name)
      }
    }
  } catch (failure) {
    if (!(failure instanceof Error && 'code' in failure && failure.code === 'ENOENT')) {
      error = 'Could not read Hermes profiles. Retry Refresh.'
    }
  }
  const profiles: BotProfile[] = []
  for (const id of names.sort((a, b) =>
    a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b)
  )) {
    const profileHome = id === 'default' ? home : path.join(profilesRoot, id)
    const profile: BotProfile = {
      key: `local:${id}`,
      host: 'local',
      id,
      label: await profileLabel(profileHome, id),
      source: 'hermes',
      home: profileHome,
      application: 'local TUI',
      chats: []
    }
    const dbPath = path.join(profileHome, 'state.db')
    if (existsSync(dbPath)) {
      try {
        profile.chats = readHermesChats(dbPath)
      } catch {
        profile.error = 'Could not read chats. Retry Refresh.'
      }
    }
    profiles.push(profile)
  }
  return { profiles, installed: true, lastSuccess: Date.now(), ...(error ? { error } : {}) }
}

type CatalogCache = {
  key: string
  snapshot: BotProfileSnapshot
  refreshing?: Promise<BotProfileSnapshot>
}
let cache: CatalogCache = { key: '', snapshot: { profiles: [], lastSuccess: null } }

export async function getBotProfiles(
  refresh = false,
  peers: HermesPeer[] = []
): Promise<BotProfileSnapshot> {
  const key = JSON.stringify(peers)
  if (key !== cache.key) {
    cache = { key, snapshot: { profiles: [], lastSuccess: null } }
  }
  const selected = cache
  const snapshot = selected.snapshot
  if (!refresh && snapshot.lastSuccess && Date.now() - snapshot.lastSuccess < 60_000) {
    return snapshot
  }
  selected.refreshing ??= Promise.all([
    readLocalBotProfiles().catch(() => ({
      profiles: [],
      lastSuccess: null,
      error: 'Could not read local bots.'
    })),
    ...peers.map(readPeerBotProfiles)
  ])
    .then(([local, ...remote]): BotProfileSnapshot => ({
      ...local,
      lastSuccess: Date.now(),
      profiles: [...local.profiles, ...remote.flatMap((result) => result.profiles)],
      peers: peers.map((peer, index) => ({ name: peer.name, error: remote[index].error }))
    }))
    .then((result) => (selected.snapshot = result))
    .finally(() => {
      selected.refreshing = undefined
    })
  return selected.refreshing
}
