import { TerminalPaneSurface } from './controller/TerminalPaneSurface'
import { useWorkerTabHidden } from '../terminal/use-worker-tab-visibility' // RA: no xterm until row click.
import { TerminalRestoringPlaceholder } from './mounting/TerminalRestoringPlaceholder'
import { useTerminalPaneController } from './controller/use-terminal-pane-controller'
import { useHostTerminalScrollbackHold } from './snapshots/use-host-terminal-scrollback-hold'
import type { TerminalPaneProps } from './controller/terminal-pane-types'

function MountedTerminalPane(props: TerminalPaneProps): React.JSX.Element {
  return <TerminalPaneSurface controller={useTerminalPaneController(props)} />
}

function VisibleTerminalPane(props: TerminalPaneProps): React.JSX.Element {
  const holdForHostScrollback = useHostTerminalScrollbackHold(props.tabId, props.worktreeId)
  return holdForHostScrollback ? (
    <TerminalRestoringPlaceholder />
  ) : (
    <MountedTerminalPane {...props} />
  )
}

// RA: Mounting/unmounting the existing surface disposes its view while main retains the PTY.
export default function TerminalPane(props: TerminalPaneProps): React.JSX.Element | null {
  const hidden = useWorkerTabHidden(props.worktreeId, props.tabId)
  if (hidden) return null
  return <VisibleTerminalPane {...props} />
}
