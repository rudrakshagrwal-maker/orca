import { useEffect, useState } from 'react'
import type { RateLimitState } from '../../../../shared/rate-limit-types'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { useWindowStreamVisible } from '@/hooks/use-window-stream-visibility'
import { useActiveAccountOwner } from '@/runtime/provider-accounts/ownership/use-active-account-owner'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { useAppStore } from '@/store/index'

const LOCAL_TARGET: RuntimeClientTarget = { kind: 'local' }
const POLL_INTERVAL_MS = 15 * 60_000

export function useSidebarAgentUsage(): RateLimitState | null {
  const visible = useWindowStreamVisible(0)
  const { target, wslHostDistro } = useActiveAccountOwner(LOCAL_TARGET)
  const selectionKey = useAppStore((state) =>
    JSON.stringify([
      state.settings?.activeClaudeManagedAccountId,
      state.settings?.activeClaudeManagedAccountIdsByRuntime,
      state.settings?.activeCodexManagedAccountId,
      state.settings?.activeCodexManagedAccountIdsByRuntime,
      state.settings?.localAccountRuntime,
      state.settings?.localAccountWslDistro,
      state.settings?.localWindowsRuntimeDefault
    ])
  )
  const ownerKey = JSON.stringify([target, wslHostDistro, selectionKey])
  const [snapshot, setSnapshot] = useState<{
    ownerKey: string
    usage: RateLimitState | null
  } | null>(null)

  useEffect(() => {
    if (!visible) {
      return
    }
    const abort = new AbortController()
    let pending = false
    // Quota reads begin at the first interval, never on mount, focus or restore.
    const timer = window.setInterval(() => {
      if (pending) {
        return
      }
      pending = true
      void callRuntimeRpc<{ rateLimits?: RateLimitState | null }>(
        target,
        'accounts.list',
        {
          refreshUsage: true,
          ...(wslHostDistro ? { usageTarget: { runtime: 'wsl', wslDistro: wslHostDistro } } : {})
        },
        { timeoutMs: 30_000, signal: abort.signal, suppressFeatureInteraction: true }
      )
        .then(
          (result) => {
            if (!abort.signal.aborted) {
              setSnapshot({ ownerKey, usage: result.rateLimits ?? null })
            }
          },
          () => {
            if (!abort.signal.aborted) {
              setSnapshot({ ownerKey, usage: null })
            }
          }
        )
        .finally(() => {
          pending = false
        })
    }, POLL_INTERVAL_MS)
    return () => {
      abort.abort()
      window.clearInterval(timer)
    }
  }, [visible, target, wslHostDistro, ownerKey])

  return snapshot?.ownerKey === ownerKey ? snapshot.usage : null
}
