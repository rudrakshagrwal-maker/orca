import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import type { ProviderRateLimits, RateLimitWindow } from '../../shared/rate-limit-types'
import type { LocalAccountRuntimeTarget } from '../../shared/local-account-runtime'
import type { ClaudeRuntimeAuthService } from '../claude-accounts/runtime-auth-service'
import type { CodexRuntimeHomeService } from '../codex-accounts/runtime-home-service'
import { getSystemCodexHomePath } from '../codex/configuration/homes/codex-home-paths'
import { isWslDistroRunning } from '../wsl/discovery/wsl-background-distro-gate'
import { getDefaultWslDistro } from '../wsl/discovery/distro-catalog'
import {
  readClaudeOAuthCredentials,
  resolveClaudeOAuthCredentialReadOptions
} from './claude-oauth-credentials'
import { classifyCodexRateLimitWindows } from './providers/codex/codex-rate-limit-window-classification'

const claudeWindow = z.object({ utilization: z.number(), resets_at: z.string().nullable() })
const claudeUsage = z.object({
  five_hour: claudeWindow.nullish(),
  seven_day: claudeWindow.nullish()
})
const codexWindow = z.object({
  used_percent: z.number(),
  limit_window_seconds: z.number().optional(),
  reset_at: z.number().nullable().optional()
})
const codexUsage = z.object({
  rate_limit: z
    .object({
      primary_window: codexWindow.nullish(),
      secondary_window: codexWindow.nullish()
    })
    .nullish()
})
const codexAuth = z.object({
  tokens: z.object({ access_token: z.string(), account_id: z.string().nullish() })
})

function usageWindow(percent: number, minutes: number, reset: number | null): RateLimitWindow {
  return {
    usedPercent: percent,
    windowMinutes: minutes,
    resetsAt: reset !== null && Number.isFinite(reset) ? reset : null,
    resetDescription: null
  }
}

async function requestUsage(url: string, headers: Record<string, string>): Promise<unknown> {
  // Only these fixed provider endpoints bypass the fork's loopback-only service client.
  const response = await globalThis.fetch(url, {
    headers,
    signal: AbortSignal.timeout(10_000),
    redirect: 'error'
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`Usage request failed (${response.status})`)
  }
  return response.json()
}

export async function fetchAgentUsage(
  provider: 'claude' | 'codex',
  target: LocalAccountRuntimeTarget,
  services: {
    claudeRuntimeAuth: Pick<ClaudeRuntimeAuthService, 'prepareForRateLimitFetch'>
    codexRuntimeHome: Pick<CodexRuntimeHomeService, 'prepareForRateLimitFetch'>
  }
): Promise<ProviderRateLimits> {
  const base = { provider, session: null, weekly: null, updatedAt: Date.now(), error: null }
  try {
    const distro = target.runtime === 'wsl' ? target.wslDistro || getDefaultWslDistro() : null
    if (target.runtime === 'wsl' && (!distro || !(await isWslDistroRunning(distro)))) {
      throw new Error('The account WSL distro is not running')
    }
    const effectiveTarget = { ...target, wslDistro: distro }
    if (provider === 'claude') {
      const preparation = await services.claudeRuntimeAuth.prepareForRateLimitFetch(effectiveTarget)
      if (preparation.usageError) {
        throw new Error(preparation.usageError)
      }
      const credentials = await readClaudeOAuthCredentials(
        resolveClaudeOAuthCredentialReadOptions(preparation)
      )
      if (!credentials.token) {
        throw new Error('Sign in to Claude to read usage')
      }
      const data = claudeUsage.parse(
        await requestUsage('https://api.anthropic.com/api/oauth/usage', {
          Authorization: `Bearer ${credentials.token}`,
          'anthropic-beta': 'oauth-2025-04-20',
          'User-Agent': 'claude-code/2.1.0'
        })
      )
      return {
        ...base,
        status: 'ok',
        session: data.five_hour
          ? usageWindow(data.five_hour.utilization, 300, Date.parse(data.five_hour.resets_at ?? ''))
          : null,
        weekly: data.seven_day
          ? usageWindow(
              data.seven_day.utilization,
              10080,
              Date.parse(data.seven_day.resets_at ?? '')
            )
          : null
      }
    }
    const home = services.codexRuntimeHome.prepareForRateLimitFetch(
      effectiveTarget,
      distro ?? undefined
    )
    if (home.kind === 'skip' || (target.runtime === 'wsl' && home.codexHomePath === null)) {
      throw new Error('The selected Codex account is unavailable')
    }
    const auth = codexAuth.parse(
      JSON.parse(
        await readFile(join(home.codexHomePath ?? getSystemCodexHomePath(), 'auth.json'), 'utf8')
      )
    )
    const headers: Record<string, string> = { Authorization: `Bearer ${auth.tokens.access_token}` }
    if (auth.tokens.account_id) {
      headers['ChatGPT-Account-Id'] = auth.tokens.account_id
    }
    const data = codexUsage.parse(
      await requestUsage('https://chatgpt.com/backend-api/wham/usage', headers)
    )
    const snapshot = (raw: z.infer<typeof codexWindow> | null | undefined) =>
      raw
        ? {
            usedPercent: raw.used_percent,
            windowDurationMins: raw.limit_window_seconds
              ? Math.ceil(raw.limit_window_seconds / 60)
              : undefined,
            resetsAt: raw.reset_at
          }
        : null
    const windows = classifyCodexRateLimitWindows({
      primary: snapshot(data.rate_limit?.primary_window),
      secondary: snapshot(data.rate_limit?.secondary_window)
    })
    const mapWindow = (raw: typeof windows.session, minutes: number) =>
      raw
        ? usageWindow(
            raw.usedPercent,
            typeof raw.windowDurationMins === 'number' ? raw.windowDurationMins : minutes,
            typeof raw.resetsAt === 'number' ? raw.resetsAt * 1000 : null
          )
        : null
    return {
      ...base,
      status: 'ok',
      session: mapWindow(windows.session, 300),
      weekly: mapWindow(windows.weekly, 10080)
    }
  } catch {
    // Credential and transport errors can contain secrets; expose only the provider's failure state.
    return {
      ...base,
      status: 'unavailable',
      error: `Unable to read ${provider} usage. Check the account sign-in.`
    }
  }
}
