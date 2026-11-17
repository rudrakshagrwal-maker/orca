import type { Session } from 'electron'
// RA: agent CLIs own their networking; Orca's service client is loopback-only.
import { isLocalOrcaRequest } from '../../shared/local-orca-request'

/** Desktop uses Chromium session/proxy state and user agent; headless hosts use Node/environment defaults.
 * Callers must consume or cancel response bodies: unread undici bodies can crash the process. */

export type MainHttpClient = {
  fetch(url: string, init?: RequestInit): Promise<Response>
  proxySession(): Session | null
  partitionSession?(partition: string): Session
}

const nodeHttpClient: MainHttpClient = {
  fetch: (url, init) => globalThis.fetch(url, init),
  proxySession: () => null
}

let current: MainHttpClient = nodeHttpClient

export function setMainHttpClient(client: MainHttpClient | null): void {
  current = client ?? nodeHttpClient
}

export function getMainHttpClient(): MainHttpClient {
  return localHttpClient
}

// RA: reject before transport dispatch and refuse redirects that could escape loopback.
const localHttpClient: MainHttpClient = {
  fetch: async (url, init) => {
    if (!isLocalOrcaRequest(url)) {
      throw new Error('Orca services are local-only')
    }
    return current.fetch(url, { ...init, redirect: 'error' })
  },
  // RA: service-owned cookie sessions are retired; browser guests create their own partitions.
  proxySession: () => current.proxySession()
}

export function requirePartitionSession(partition: string, providerLabel: string): Session {
  const client = getMainHttpClient()
  if (!client.partitionSession) {
    throw new Error(
      `${providerLabel} usage from a session cookie needs the Orca desktop app and is not available on this server`
    )
  }
  return client.partitionSession(partition)
}
