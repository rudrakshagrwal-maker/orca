import { afterEach, expect, it, vi } from 'vitest'
import { fetchAgentUsage } from './agent-usage-fetch'
import type { CodexRateLimitHomeResolution } from '../codex-accounts/runtime-home-service-types'

const mocks = vi.hoisted(() => ({ readFile: vi.fn(), credentials: vi.fn(), running: vi.fn() }))
vi.mock('node:fs/promises', () => ({ readFile: mocks.readFile }))
vi.mock('./claude-oauth-credentials', () => ({
  readClaudeOAuthCredentials: mocks.credentials,
  resolveClaudeOAuthCredentialReadOptions: () => ({})
}))
vi.mock('../codex/configuration/homes/codex-home-paths', () => ({
  getSystemCodexHomePath: () => '/system-codex'
}))
vi.mock('../wsl/discovery/wsl-background-distro-gate', () => ({
  isWslDistroRunning: mocks.running
}))
vi.mock('../wsl/discovery/distro-catalog', () => ({ getDefaultWslDistro: () => 'Ubuntu' }))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const services = {
  claudeRuntimeAuth: {
    prepareForRateLimitFetch: vi.fn(async () => ({
      configDir: '/claude',
      envPatch: {},
      provenance: 'system'
    }))
  },
  codexRuntimeHome: {
    prepareForRateLimitFetch: vi.fn((): CodexRateLimitHomeResolution => ({
      kind: 'ready' as const,
      codexHomePath: '/selected-codex'
    }))
  }
}
const target = { runtime: 'host' as const, wslDistro: null }

it('maps Claude quota windows from its selected login', async () => {
  mocks.credentials.mockResolvedValue({ token: 'claude-token' })
  const fetch = vi.fn(async () =>
    Response.json({
      five_hour: { utilization: 24, resets_at: '2026-11-19T12:00:00Z' },
      seven_day: { utilization: 63, resets_at: '2026-11-25T12:00:00Z' }
    })
  )
  vi.stubGlobal('fetch', fetch)
  const result = await fetchAgentUsage('claude', target, services)
  expect(result.session).toEqual({
    usedPercent: 24,
    windowMinutes: 300,
    resetsAt: 1795089600000,
    resetDescription: null
  })
  expect(result.weekly?.usedPercent).toBe(63)
  expect(fetch).toHaveBeenCalledWith(
    'https://api.anthropic.com/api/oauth/usage',
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer claude-token' }),
      redirect: 'error'
    })
  )
})

it('classifies swapped Codex windows and converts reset seconds to milliseconds', async () => {
  mocks.readFile.mockResolvedValue(
    JSON.stringify({ tokens: { access_token: 'codex-token', account_id: 'selected-account' } })
  )
  const fetch = vi.fn(async () =>
    Response.json({
      rate_limit: {
        primary_window: { used_percent: 73, limit_window_seconds: 604800, reset_at: 1795608000 },
        secondary_window: { used_percent: 19, limit_window_seconds: 18000, reset_at: 1795089600 }
      }
    })
  )
  vi.stubGlobal('fetch', fetch)
  const result = await fetchAgentUsage('codex', target, services)
  expect(result.session).toEqual({
    usedPercent: 19,
    windowMinutes: 300,
    resetsAt: 1795089600000,
    resetDescription: null
  })
  expect(result.weekly).toEqual({
    usedPercent: 73,
    windowMinutes: 10080,
    resetsAt: 1795608000000,
    resetDescription: null
  })
  expect(fetch).toHaveBeenCalledWith(
    'https://chatgpt.com/backend-api/wham/usage',
    expect.objectContaining({
      headers: { Authorization: 'Bearer codex-token', 'ChatGPT-Account-Id': 'selected-account' },
      redirect: 'error'
    })
  )
})

it('does not fall back to host credentials for an unavailable WSL account', async () => {
  mocks.running.mockResolvedValue(false)
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const result = await fetchAgentUsage('codex', { runtime: 'wsl', wslDistro: 'Ubuntu' }, services)
  expect(result.status).toBe('unavailable')
  expect(result.session).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
  expect(mocks.readFile).not.toHaveBeenCalled()
})

it('keeps credential-bearing transport errors out of renderer state', async () => {
  mocks.credentials.mockResolvedValue({ token: 'secret-token' })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('Authorization: secret-token')
    })
  )
  const result = await fetchAgentUsage('claude', target, services)
  expect(result.status).toBe('unavailable')
  expect(JSON.stringify(result)).not.toContain('secret-token')
})

it('does not read the host Codex home when a running WSL home is unresolved', async () => {
  mocks.running.mockResolvedValue(true)
  services.codexRuntimeHome.prepareForRateLimitFetch.mockReturnValueOnce({
    kind: 'ready',
    codexHomePath: null
  })
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const result = await fetchAgentUsage('codex', { runtime: 'wsl', wslDistro: 'Ubuntu' }, services)
  expect(result.status).toBe('unavailable')
  expect(fetch).not.toHaveBeenCalled()
  expect(mocks.readFile).not.toHaveBeenCalled()
})
