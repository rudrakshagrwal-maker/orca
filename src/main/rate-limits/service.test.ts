import { expect, it, vi } from 'vitest'
import { RateLimitService } from './service'
import type { ProviderRateLimits } from '../../shared/rate-limit-types'

it('does not fetch until requested and rejects results after an account change', async () => {
  let account = 'account-a'
  const resolvers: ((value: ProviderRateLimits) => void)[] = []
  const fetch = vi.fn(
    () =>
      new Promise<ProviderRateLimits>((done) => {
        resolvers.push(done)
      })
  )
  const service = new RateLimitService(
    () => ({ key: account, target: { runtime: 'host', wslDistro: null } }),
    fetch
  )
  expect(service.getState().claude).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
  const request = service.refresh()
  account = 'account-b'
  for (const resolve of resolvers) {
    resolve({
      provider: 'codex',
      session: null,
      weekly: null,
      status: 'ok',
      error: null,
      updatedAt: 1
    })
  }
  await request
  expect(service.getState().codex).toBeNull()
})
