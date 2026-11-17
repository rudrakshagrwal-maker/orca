import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import { isOmpOverlayScreen } from './omp-terminal-readiness'
import { isCodexBusyScreen } from '../../agent-state-rules/codex-screen-predicates'
import { isClaudeBusyScreen, isClaudeInputDialogScreen } from './claude-screen-state'

/** An agent's grid as painted on its own PTY, and whether that is the alternate screen. */
export type RuledScreen = { lines: readonly string[]; alternateScreen: boolean }

/** OMP paints idle before its setup wizard opens; screen vetoes must override title, hook and quiet evidence. */
const SCREEN_INPUT_VETOES: Partial<Record<TuiAgent, (screen: RuledScreen) => boolean>> = {
  omp: isOmpOverlayScreen,
  // RA: Claude's live dialogs and overlays own input even when its title says idle and no hook arrived.
  claude: (screen) => isClaudeInputDialogScreen(screen.lines)
}

// RA: a live status row proves a turn is open; vetoes only ready verdicts, never delivery to a working agent.
const SCREEN_BUSY_RULES: Partial<Record<TuiAgent, (screen: RuledScreen) => boolean>> = {
  claude: (screen) => isClaudeBusyScreen(screen.lines),
  codex: (screen) => isCodexBusyScreen(screen.lines)
}

/** Whether the agent's live screen shows a running turn; null with no rule or no trustworthy screen. */
export function readScreenBusy(
  agent: TuiAgent | null | undefined,
  readScreen: () => RuledScreen | null
): boolean | null {
  const busy = agent ? SCREEN_BUSY_RULES[agent] : undefined
  const screen = busy ? readScreen() : null
  return busy && screen ? busy(screen) : null
}

/** Whether the agent's live screen refuses input; null with no veto rule or no trustworthy screen. */
export function readScreenInputVeto(
  agent: TuiAgent | null | undefined,
  readScreen: () => RuledScreen | null
): boolean | null {
  const veto = agent ? SCREEN_INPUT_VETOES[agent] : undefined
  const screen = veto ? readScreen() : null
  return veto && screen ? veto(screen) : null
}
