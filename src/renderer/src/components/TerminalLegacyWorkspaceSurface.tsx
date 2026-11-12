import { TerminalLegacyTerminalPanes } from './TerminalLegacyTerminalPanes'
import type { TerminalController } from './use-terminal-controller'

export function TerminalLegacyWorkspaceSurface({
  controller
}: {
  controller: TerminalController
}): React.JSX.Element | null {
  if (controller.effectiveActiveLayout || controller.anyMountedWorktreeHasLayout) {
    return null
  }
  return (
    <>
      <TerminalLegacyTerminalPanes controller={controller} />
      {/* RA: only terminal surfaces mount, including legacy restored workspaces. */}
    </>
  )
}
