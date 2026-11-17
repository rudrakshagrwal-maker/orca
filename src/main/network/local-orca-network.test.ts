import type { Session } from 'electron'
import { afterEach, expect, it, vi } from 'vitest'
import { getMainHttpClient, setMainHttpClient } from './http-client'
import { isLocalOrcaRequest } from '../../shared/local-orca-request'
import { installElectronProxyRequestGuard } from './electron-proxy-request-guard'

vi.mock('./proxy-settings', () => ({ getProxySessionApplicationReadiness: () => true }))

afterEach(() => setMainHttpClient(null))

// RA: no account/updater/marketplace/analytics endpoint can reach Orca's HTTP transport.
it.each([
  'https://login.onorca.dev/v1/desktop/auth/refresh',
  'https://relay.onorca.dev',
  'https://push.onorca.dev',
  'https://us.i.posthog.com/capture',
  'https://api.github.com/repos/stablyai/orca/releases',
  'https://onorca.dev/plugins/stats.json',
  'http://localhost.example.com',
  'https://127.0.0.1.example.com',
  'ftp://example.com/file'
])('rejects outbound service request %s before dispatch', async (url) => {
  const fetch = vi.fn()
  setMainHttpClient({ fetch, proxySession: () => null })
  await expect(getMainHttpClient().fetch(url)).rejects.toThrow('local-only')
  expect(fetch).not.toHaveBeenCalled()
})

it('keeps local daemon calls and prevents a redirect from escaping loopback', async () => {
  const fetch = vi.fn(async () => new Response('local'))
  setMainHttpClient({ fetch, proxySession: () => null })
  await expect(getMainHttpClient().fetch('http://127.0.0.1:4311/rpc')).resolves.toBeInstanceOf(
    Response
  )
  expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:4311/rpc', { redirect: 'error' })
  expect(isLocalOrcaRequest('ws://[::1]:4311')).toBe(true)
  expect(isLocalOrcaRequest('file:///C:/Orca/index.html')).toBe(true)
})

it('blocks direct Chromium app requests while retaining local app resources', () => {
  type Handler = (
    details: { url: string },
    callback: (result: { cancel?: boolean }) => void
  ) => void
  let handler!: Handler
  const session = {
    webRequest: {
      onBeforeRequest: (next: Handler) => {
        handler = next
      }
    }
  }
  installElectronProxyRequestGuard(session as unknown as Session)
  const answer = vi.fn()
  handler({ url: 'https://onorca.dev/changelog' }, answer)
  expect(answer).toHaveBeenLastCalledWith({ cancel: true })
  handler({ url: 'http://localhost:5173/src/main.tsx' }, answer)
  expect(answer).toHaveBeenLastCalledWith({})
})
