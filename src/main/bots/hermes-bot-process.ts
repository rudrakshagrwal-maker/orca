import { join, posix } from 'node:path'
import { existsSync } from 'node:fs'
import { findSystemSsh } from '../ssh/system-transport/system-ssh-binary'
import { validBotId } from './bot-profile-catalog'
import { hermesSshArgs } from './hermes-peer-transport'
import { resolveHermesPeers } from '../../shared/hermes-peers'
import type { HermesPeer } from '../../shared/bot-profile-types'

export function hermesBotProcess(
  key: string,
  pinnedHome: string,
  env: Record<string, string>,
  peers?: HermesPeer[]
) {
  const [host, profile, extra] = key.split(':')
  if (extra !== undefined || !host || !profile || !validBotId(profile)) {
    throw new Error('Invalid bot id')
  }
  if (host !== 'local') {
    const peer = resolveHermesPeers(peers).find((candidate) => candidate.name === host)
    if (!peer) {
      throw new Error('Hermes peer was removed. Refresh Bots.')
    }
    const home =
      profile === 'default' ? peer.hermesHome : posix.join(peer.hermesHome, 'profiles', profile)
    if (home !== pinnedHome) {
      throw new Error('Hermes peer home changed. Open a new bot chat.')
    }
    const command = findSystemSsh()
    if (!command) {
      throw new Error('OpenSSH is not installed on this host')
    }
    return {
      command,
      args: hermesSshArgs(peer, [peer.hermesBin, '-p', profile, 'acp']),
      env,
      sessionCwd: home
    }
  }
  const root = profile === 'default' ? pinnedHome : join(pinnedHome, '..', '..')
  const windowsBin = env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'hermes', 'bin', 'hermes.exe')
  const command =
    process.platform === 'win32' && windowsBin && existsSync(windowsBin) ? windowsBin : 'hermes'
  return { command, args: ['-p', profile, 'acp'], env: { ...env, HERMES_HOME: root } }
}
