import type { ProviderRateLimits, RateLimitWindow } from '../../../../shared/rate-limit-types'
import { useStatusBarController } from '../status-bar/use-status-bar-controller'
import { translate } from '@/i18n/i18n'

function UsageWindow({ label, window }: { label: string; window: RateLimitWindow | null }) {
  const percent = window ? Math.round(window.usedPercent) : null
  const resetDate = window?.resetsAt ? new Date(window.resetsAt) : null
  const reset = resetDate
    ? [
        window && window.windowMinutes >= 10080
          ? resetDate.toLocaleDateString(undefined, { weekday: 'short' })
          : null,
        resetDate.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      ]
        .filter(Boolean)
        .join(' ')
    : window?.resetDescription
  return (
    <span className="min-w-0 flex-[3] last:flex-[4]" title={reset ?? undefined}>
      <span className="flex items-center justify-between gap-1 whitespace-nowrap text-3xs tabular-nums">
        <span className="shrink-0">
          {label} {percent === null ? '—' : `${percent}%`}
        </span>
        <span className="truncate text-muted-foreground">{reset ?? '—'}</span>
      </span>
      <span
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        className="mt-0.5 block h-0.5 overflow-hidden rounded-full bg-worktree-sidebar-accent"
      >
        <span
          className="block h-full bg-worktree-sidebar-foreground/60"
          style={{ width: `${Math.max(0, Math.min(100, percent ?? 0))}%` }}
        />
      </span>
    </span>
  )
}

export function SidebarAgentUsageRows({
  providers,
  onOpenProvider
}: {
  providers: ProviderRateLimits[]
  onOpenProvider: (provider: ProviderRateLimits['provider']) => void
}) {
  if (providers.length === 0) {
    return null
  }
  return (
    <div
      aria-label={translate('auto.components.status.bar.UsageRosterPanel.title', 'Usage')}
      className="shrink-0 border-t border-worktree-sidebar-border px-2 py-1 text-worktree-sidebar-foreground"
    >
      {providers.map((provider) => (
        <button
          key={provider.provider}
          type="button"
          onClick={() => onOpenProvider(provider.provider)}
          className="flex w-full items-center gap-1 rounded-md py-1 text-left hover:bg-worktree-sidebar-accent focus-visible:outline-ring"
          aria-label={`${provider.provider}: ${provider.error ?? provider.status}`}
        >
          <span className="w-9 shrink-0 truncate text-3xs capitalize">{provider.provider}</span>
          <UsageWindow label="5h" window={provider.session} />
          <UsageWindow label="7d" window={provider.weekly} />
        </button>
      ))}
    </div>
  )
}

export function SidebarAgentUsage() {
  const controller = useStatusBarController(false, true)
  if (!controller) {
    return null
  }
  return (
    <SidebarAgentUsageRows
      providers={controller.rosterProviders}
      onOpenProvider={controller.handleOpenProviderAccounts}
    />
  )
}
