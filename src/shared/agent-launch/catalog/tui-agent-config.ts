import type { FORK_TUI_AGENTS, TuiAgent } from './tui-agent'
import { skipsLinuxOrcaCliRename } from '../../orca-cli-command-name'
import type { TuiAgentConfig, TuiAgentConfigSource } from './tui-agent-config-types'

function resolveTuiAgentConfig(source: TuiAgentConfigSource): TuiAgentConfig {
  return {
    ...source,
    launchCmd: source.launchCmd ?? source.detectCmd,
    expectedProcess: source.expectedProcess ?? source.detectCmd
  }
}

const TUI_AGENT_CONFIG_SOURCE = {
  claude: {
    detectCmd: 'claude',
    promptInjectionMode: 'argv',
    pasteNeedsTypedRequest: true,
    draftPromptFlag: '--prefill',
    preflightTrust: 'claude',
    draftPasteReadySignal: 'claude-composer-prompt',
    workerStartReadsComposerMarker: true,
    ctrlEnterEncoding: 'csi-u'
  },
  codex: {
    detectCmd: 'codex',
    promptInjectionMode: 'argv',
    windowsInputRecordPasteNewline: 'alt-enter',
    preflightTrust: 'codex',
    draftPasteReadySignal: 'codex-composer-prompt',
    draftPasteReadyTimeoutMs: 20_000,
    submitRetryDelayMs: 1200
  },
  antigravity: {
    detectCmd: 'agy',
    promptInjectionMode: 'flag-prompt-interactive',
    // Antigravity trust is exact-path, so every child workspace can show a menu that consumes paste; pre-write trust (agent-trust-presets.ts).
    preflightTrust: 'antigravity',
    // The shell's own 2004h armed the quiet window, so a slow agy start got the paste in cooked mode (#18088).
    draftPasteReadySignal: 'antigravity-composer-prompt',
    draftPasteReadyTimeoutMs: 20_000,
    // agy 1.2.x expands collapsed multiline pastes over seconds; byte ingest finishing does not prove submit readiness.
    submitLineSettleMsPerLine: 45
  },
  hermes: {
    detectCmd: 'hermes',
    launchCmd: 'hermes --tui',
    promptInjectionMode: 'hermes-query'
  },
  dsh: {
    detectCmd: 'dsh',
    detectCmdAliases: ['dsh-tui', 'dst'],
    detectRequiredCommands: ['dsh'],
    // Use the installed harness directly; dsh-tui/dst are separate community wrappers.
    launchCmd: 'dsh --profile dsh-tui',
    promptInjectionMode: 'stdin-after-start',
    draftPasteReadySignal: 'dsh-composer-prompt',
    submitRetryDelayMs: 1000,
    submitRetryBudgetMs: 30_000
  }
} satisfies Record<(typeof FORK_TUI_AGENTS)[number], TuiAgentConfigSource>

export const TUI_AGENT_CONFIG: Record<TuiAgent, TuiAgentConfig> = Object.fromEntries(
  Object.entries(TUI_AGENT_CONFIG_SOURCE).map(([agent, source]) => [
    agent,
    resolveTuiAgentConfig(source)
  ])
) as Record<TuiAgent, TuiAgentConfig>

export function isTuiAgent(value: unknown): value is TuiAgent {
  return typeof value === 'string' && Object.hasOwn(TUI_AGENT_CONFIG, value)
}

export function getTuiAgentDetectCommands(config: TuiAgentConfig): string[] {
  return [config.detectCmd, ...(config.detectCmdAliases ?? [])]
}

export function getTuiAgentLaunchCommand(
  config: TuiAgentConfig,
  platform: NodeJS.Platform,
  opts?: { isRemote?: boolean }
): string {
  if (platform === 'linux' && skipsLinuxOrcaCliRename(opts?.isRemote)) {
    return config.launchCmd
  }
  return config.launchCmdByPlatform?.[platform] ?? config.launchCmd
}
