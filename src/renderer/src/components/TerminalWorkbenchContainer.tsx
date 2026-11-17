import type React from 'react'

// RA: hidden workbenches never retain browser paint work.
export function TerminalWorkbenchContainer({
  isVisible,
  children
}: {
  isVisible: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={isVisible ? 'flex flex-1 min-w-0 min-h-0' : 'hidden flex-1 min-w-0 min-h-0'}
      // Keep hidden paintable panes outside keyboard/accessibility navigation.
      inert={!isVisible}
      aria-hidden={!isVisible}
      data-terminal-workbench-container=""
    >
      {children}
    </div>
  )
}
