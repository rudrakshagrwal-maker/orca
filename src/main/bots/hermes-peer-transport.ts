import { homedir } from 'node:os'
import { join } from 'node:path'
import type { HermesPeer } from '../../shared/bot-profile-types'

export const quoteRemoteArg = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`

export function hermesSshArgs(peer: HermesPeer, args: string[], terminal = false): string[] {
  const key = peer.keyPath.startsWith('~/') ? join(homedir(), peer.keyPath.slice(2)) : peer.keyPath
  return [
    terminal ? '-tt' : '-T',
    '-o',
    'BatchMode=yes',
    '-o',
    'ConnectTimeout=6',
    '-o',
    'ServerAliveInterval=5',
    '-o',
    'ServerAliveCountMax=1',
    '-i',
    key,
    `${peer.user}@${peer.host}`,
    ['sudo', '-n', '-u', peer.remoteUser, 'env', `HERMES_HOME=${peer.hermesHome}`, ...args]
      .map(quoteRemoteArg)
      .join(' ')
  ]
}
