import { TerminalPaneSurface } from './controller/TerminalPaneSurface'
import { useWorkerTabHidden } from '../terminal/use-worker-tab-visibility' // RA: no xterm until row click.
import { BotTerminalRestoreGate } from './BotTerminalRestoreGate' // RA: separate identity from process survival.
import { useAppStore } from '@/store' // RA: ordinary terminals do not mount bot restore subscriptions.
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
  const bot = useAppStore((state) => Boolean(state.tabsByWorktree[props.worktreeId]?.find((tab) => tab.id === props.tabId)?.botProfile))
  if (hidden) return null
  return bot ? (
    <BotTerminalRestoreGate tabId={props.tabId} worktreeId={props.worktreeId}>
      <VisibleTerminalPane {...props} />
    </BotTerminalRestoreGate>
  ) : <VisibleTerminalPane {...props} />
}
