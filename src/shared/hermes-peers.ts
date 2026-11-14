import { z } from 'zod'
import type { HermesPeer } from './bot-profile-types'
export type HermesPeerSettings = { hermesPeers?: HermesPeer[] }

const name = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/)
const remotePath = z
  .string()
  .min(1)
  .max(4096)
  .regex(/^\/[^\r\n\0]*$/)
export const HermesPeersSchema = z
  .array(
    z
      .object({
        name: name.refine((value) => value !== 'local', 'local is reserved'),
        host: z
          .string()
          .min(1)
          .max(255)
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9.:-]*$/),
        user: name,
        keyPath: z
          .string()
          .min(1)
          .max(4096)
          .regex(/^[^\r\n\0]+$/),
        remoteUser: name,
        hermesHome: remotePath,
        hermesBin: remotePath
      })
      .strict()
  )
  .max(16)
  .refine(
    (peers) => new Set(peers.map((peer) => peer.name)).size === peers.length,
    'Peer names must be unique'
  )

export const DEFAULT_HERMES_PEERS: HermesPeer[] = [
  {
    name: 'box',
    host: '100.65.84.89',
    user: 'root',
    keyPath: '~/.ssh/hetzner',
    remoteUser: 'hermes',
    hermesHome: '/home/hermes/.hermes',
    hermesBin: '/home/hermes/.local/bin/hermes'
  }
]

export function resolveHermesPeers(peers: unknown): HermesPeer[] {
  return HermesPeersSchema.parse(peers ?? DEFAULT_HERMES_PEERS)
}
