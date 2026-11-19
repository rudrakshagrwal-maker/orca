import type { RateLimitState, ProviderRateLimits } from '../../shared/rate-limit-types'
import { createEmptyRateLimitState } from '../../shared/rate-limit-state-factory'
import type { LocalAccountRuntimeTarget } from '../../shared/local-account-runtime'

export class RateLimitService {
  private snapshots = new Map<string, RateLimitState>()
  private pending = new Map<string, Promise<void>>()

  constructor(
    private readonly resolveKey: (target?: LocalAccountRuntimeTarget) => {
      key: string
      target: LocalAccountRuntimeTarget
    },
    private readonly fetchUsage: (
      provider: 'claude' | 'codex',
      target: LocalAccountRuntimeTarget
    ) => Promise<ProviderRateLimits>
  ) {}

  getState(target?: LocalAccountRuntimeTarget): RateLimitState {
    return this.snapshots.get(this.resolveKey(target).key) ?? createEmptyRateLimitState()
  }

  async refresh(target?: LocalAccountRuntimeTarget): Promise<void> {
    const resolved = this.resolveKey(target)
    const pending = this.pending.get(resolved.key)
    if (pending) {
      return pending
    }
    const request = (async () => {
      const [claude, codex] = await Promise.all([
        this.fetchUsage('claude', resolved.target),
        this.fetchUsage('codex', resolved.target)
      ])
      if (resolved.key === this.resolveKey(target).key) {
        this.snapshots.clear()
        this.snapshots.set(resolved.key, createEmptyRateLimitState({ claude, codex }))
      }
    })()
    this.pending.set(resolved.key, request)
    try {
      await request
    } finally {
      this.pending.delete(resolved.key)
    }
  }
}
