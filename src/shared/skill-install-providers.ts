import type { TuiAgent } from './agent-launch/catalog/tui-agent'

/** Null segments use canonical .agents/skills without a separate placement; IDs match detected Orca agents. */
type SkillInstallProviderEntry = {
  id: TuiAgent
  displayName: string
  globalSegments: readonly string[] | null
  workspaceSegments: readonly string[] | null
  /** Env var relocating the agent's home (skills in `<home>/skills`). */
  homeEnv?: string
}

// RA: skill discovery/install roots follow the same two supported agents.
export const SKILL_INSTALL_PROVIDERS: readonly SkillInstallProviderEntry[] = Object.freeze([
  {
    id: 'codex',
    displayName: 'Codex',
    globalSegments: null,
    workspaceSegments: null
  },
  {
    id: 'claude',
    displayName: 'Claude Code',
    globalSegments: ['.claude', 'skills'],
    workspaceSegments: ['.claude', 'skills'],
    homeEnv: 'CLAUDE_CONFIG_DIR'
  }
  // Project skills use the canonical root; only global scope needs separate placement.

  // Install into OpenClaude’s own roots; native-chat skillSourceOwner uses a separate mapping.
] satisfies SkillInstallProviderEntry[])

export type SkillInstallProviderDefinition = (typeof SKILL_INSTALL_PROVIDERS)[number]
export type SkillInstallProviderId = SkillInstallProviderDefinition['id']

export function isSkillInstallProviderId(value: string): value is SkillInstallProviderId {
  return SKILL_INSTALL_PROVIDERS.some((provider) => provider.id === value)
}

/** Explicit choices include agents installed later; removal omits choices to clean every previously used root. */
export function selectedOrDetectedSkillProviders(
  detectedProviders: readonly string[],
  selectedProviders: readonly string[] | undefined
): readonly string[] {
  return selectedProviders ?? detectedProviders
}
