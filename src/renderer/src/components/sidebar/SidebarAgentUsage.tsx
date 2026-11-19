import type { RateLimitState, RateLimitWindow } from '../../../../shared/rate-limit-types'
import { useSidebarAgentUsage } from './use-sidebar-agent-usage'

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

export function SidebarAgentUsageRows({ usage }: { usage: RateLimitState | null }) {
  return (
    <div
      aria-label="Agent usage"
      className="shrink-0 border-t border-worktree-sidebar-border px-2 py-1 text-worktree-sidebar-foreground"
    >
      {(['claude', 'codex'] as const).map((provider) => (
        <div
          key={provider}
          role="group"
          aria-label={provider === 'claude' ? 'Claude' : 'Codex'}
          title={usage?.[provider]?.error ?? undefined}
          className="flex w-full items-center gap-1 py-1 text-left"
        >
          <span className="w-9 shrink-0 text-3xs capitalize">{provider}</span>
          <UsageWindow label="5h" window={usage?.[provider]?.session ?? null} />
          <UsageWindow label="7d" window={usage?.[provider]?.weekly ?? null} />
        </div>
      ))}
    </div>
  )
}

export function SidebarAgentUsage() {
  return <SidebarAgentUsageRows usage={useSidebarAgentUsage()} />
}
