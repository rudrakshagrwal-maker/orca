import { PanelsTopLeft } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { lazyWithRetry } from '@/lib/lazy-with-retry'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { shouldOpenStatusBarContextMenu } from './status-bar-context-menu-policy'
import { CaffeinateStatusSegment } from './CaffeinateStatusSegment'
import { TOGGLE_FLOATING_TERMINAL_EVENT } from '@/lib/floating-terminal'
import { FloatingTerminalIconContextMenu } from '@/components/floating-terminal/FloatingTerminalIconContextMenu'
import { CLOSE_ALL_CONTEXT_MENUS_EVENT } from '@/lib/close-all-context-menus'
import { useStatusBarController } from './use-status-bar-controller'
import { StatusBarVisibilityMenu } from './StatusBarVisibilityMenu'
import { isPairedWebClientWindow } from '@/lib/desktop-window-chrome'

const PetStatusSegment = lazyWithRetry(() =>
  import('./PetStatusSegment').then((module) => ({ default: module.PetStatusSegment }))
)
const ResourceUsageStatusSegment = lazyWithRetry(() =>
  import('./ResourceUsageStatusSegment').then((module) => ({
    default: module.ResourceUsageStatusSegment
  }))
)
const PortsStatusSegment = lazyWithRetry(() =>
  import('./PortsStatusSegment').then((module) => ({ default: module.PortsStatusSegment }))
)
const SshStatusSegment = lazyWithRetry(() =>
  import('./SshStatusSegment').then((module) => ({ default: module.SshStatusSegment }))
)

export type StatusBarProps = {
  floatingTerminalOpen: boolean
}

export function StatusBarSurface({
  floatingTerminalOpen
}: StatusBarProps): React.JSX.Element | null {
  // Memoized labels still need to follow language changes.
  useTranslation()
  const controller = useStatusBarController(floatingTerminalOpen)
  if (!controller) {
    return null
  }
  const {
    barRef,
    compact,
    floatingTerminalActionLabel,
    floatingTerminalShortcut,
    overflowing,
    petEnabled,
    segmentsIconOnly,
    segmentsRef,
    setMenuOpen,
    setMenuPoint,
    showFloatingTerminalToggle,
    showFloatingWorkspaceAttentionDot,
    showPorts,
    showResourceUsage,
    showSsh
  } = controller

  return (
    <div
      ref={barRef}
      data-orca-status-bar=""
      // Why: one line at any width — density steps down first. overflow-clip (not hidden) so focus can't scroll the bar; the clip margin spares focus rings and badge dots.
      className="flex items-center h-6 min-h-[24px] px-3 gap-4 overflow-clip [overflow-clip-margin:3px] whitespace-nowrap border-t border-border bg-[var(--bg-titlebar,var(--card))] text-xs select-none shrink-0 relative"
      onContextMenuCapture={(event) => {
        if (!shouldOpenStatusBarContextMenu(event.target)) {
          return
        }
        // Close peer menus and anchor at the cursor so repeated right-clicks reposition the menu.
        event.preventDefault()
        window.dispatchEvent(new Event(CLOSE_ALL_CONTEXT_MENUS_EVENT))
        const bounds = event.currentTarget.getBoundingClientRect()
        setMenuPoint({ x: event.clientX - bounds.left, y: event.clientY - bounds.top })
        setMenuOpen(true)
      }}
    >
      <div className="flex-1" />

      {/* Why: attention segments never clip; below the tightest density they scroll rather than vanish. */}
      <div
        className="min-w-0 data-[overflowing=true]:overflow-x-auto data-[overflowing=true]:scrollbar-none"
        data-overflowing={overflowing}
      >
        <div ref={segmentsRef} className="flex w-max items-center gap-3">
          {!isPairedWebClientWindow() ? (
            <CaffeinateStatusSegment iconOnly={segmentsIconOnly} />
          ) : null}
          <React.Suspense fallback={null}>
            {petEnabled ? <PetStatusSegment /> : null}
            {showResourceUsage ? (
              <ResourceUsageStatusSegment compact={compact} iconOnly={segmentsIconOnly} />
            ) : null}
            {showPorts ? (
              <PortsStatusSegment compact={compact} iconOnly={segmentsIconOnly} />
            ) : null}
            {showSsh ? <SshStatusSegment compact={compact} iconOnly={segmentsIconOnly} /> : null}
          </React.Suspense>
          {showFloatingTerminalToggle && (
            <FloatingTerminalIconContextMenu currentLocation="status-bar" className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="relative inline-flex size-5 cursor-pointer items-center justify-center rounded border border-border bg-secondary text-secondary-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                    aria-label={
                      showFloatingWorkspaceAttentionDot
                        ? translate(
                            'auto.components.status.bar.StatusBar.floatingTerminalNewActivity',
                            '{{label}}, new activity',
                            { label: floatingTerminalActionLabel }
                          )
                        : floatingTerminalActionLabel
                    }
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent(TOGGLE_FLOATING_TERMINAL_EVENT))
                    }}
                  >
                    <PanelsTopLeft className="size-3.5" />
                    {showFloatingWorkspaceAttentionDot ? (
                      // Why: amber = Orca's "needs attention" convention; ring matches the fill so the dot reads on the icon.
                      <span
                        aria-hidden
                        data-floating-terminal-attention
                        className="pointer-events-none absolute right-0.5 top-0.5 size-1.5 rounded-full bg-amber-500 ring-1 ring-secondary"
                      />
                    ) : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  {floatingTerminalActionLabel} ({floatingTerminalShortcut})
                </TooltipContent>
              </Tooltip>
            </FloatingTerminalIconContextMenu>
          )}
        </div>
      </div>

      <StatusBarVisibilityMenu controller={controller} />
    </div>
  )
}
