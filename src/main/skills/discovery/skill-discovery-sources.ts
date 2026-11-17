// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import { homedir } from 'node:os'
import { basename, join, type posix } from 'node:path'
import type { SkillDiscoverySource, SkillProvider, SkillSourceKind } from '../../../shared/skills'
import type { AgentType } from '../../../shared/agent-status/contracts/agent-status-types'
import type { Repo } from '../../../shared/repo-types'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import {
  SKILL_INSTALL_PROVIDERS,
  type SkillInstallProviderId
} from '../../../shared/skill-install-providers'
import type { SkillProviderRootOverrides } from '../providers/skill-provider-destinations'
import { stablePathId } from './skill-discovery-classification'
import { resolveEnvironmentSkillProviderRoots } from '../providers/skill-provider-runtime-roots'

export type SkillScanRoot = Omit<SkillDiscoverySource, 'exists' | 'skippedReason'>
type SkillDiscoveryPathApi = Pick<typeof posix, 'basename' | 'join'>

function source(
  id: string,
  label: string,
  path: string,
  sourceKind: SkillSourceKind,
  providers: SkillProvider[],
  owner: AgentType | null
): SkillScanRoot {
  return { id, label, path, sourceKind, providers, owner }
}

// Why: Claude has its own SkillProvider tag; every other agent shares agent-skills.
function skillProvidersFor(id: SkillInstallProviderId): SkillProvider[] {
  return id === 'claude' ? ['claude'] : ['agent-skills']
}

function providerHomeSources(
  home: string,
  pathApi: SkillDiscoveryPathApi,
  overrides: SkillProviderRootOverrides
): SkillScanRoot[] {
  return SKILL_INSTALL_PROVIDERS.flatMap((provider) => {
    if (!provider.globalSegments) {
      return []
    }
    return [
      source(
        `home-${provider.id}`,
        `${provider.displayName} home`,
        overrides[provider.id] ?? pathApi.join(home, ...provider.globalSegments),
        'home',
        skillProvidersFor(provider.id),
        provider.id
      )
    ]
  })
}

function providerRepoSources(
  repoPath: string,
  repoLabel: string,
  pathApi: SkillDiscoveryPathApi
): SkillScanRoot[] {
  return SKILL_INSTALL_PROVIDERS.flatMap((provider) => {
    const segments = provider.workspaceSegments
    if (!segments) {
      return []
    }
    return [
      source(
        `repo-${provider.id}-${stablePathId(repoPath)}`,
        `${repoLabel} ${segments[0]}`,
        pathApi.join(repoPath, ...segments),
        'repo',
        skillProvidersFor(provider.id),
        provider.id
      )
    ]
  })
}

export function buildSkillDiscoverySources(
  args: {
    homeDir?: string
    cwd?: string
    repos?: Repo[]
    includeCwd?: boolean
    pathApi?: SkillDiscoveryPathApi
    providerRootOverrides?: SkillProviderRootOverrides
  } = {}
): SkillScanRoot[] {
  const pathApi = args.pathApi ?? { basename, join }
  const home = args.homeDir ?? homedir()
  const cwd = args.cwd ?? process.cwd()
  const providerRootOverrides =
    args.providerRootOverrides ?? (args.pathApi ? {} : resolveEnvironmentSkillProviderRoots())
  // Read HERMES_HOME only on this process's host; a custom path adapter describes another host with POSIX Hermes defaults.

  const roots: SkillScanRoot[] = [
    // Why: Codex reads `.agents/skills` today; this legacy home still holds older installs.
    source(
      'home-codex',
      'Codex home',
      pathApi.join(home, '.codex', 'skills'),
      'home',
      ['codex'],
      'codex'
    ),
    source(
      'home-agents',
      'Agent skills home',
      pathApi.join(home, '.agents', 'skills'),
      'home',
      ['agent-skills'],
      null
    ),
    source(
      'codex-plugin-cache',
      'Codex plugin cache',
      pathApi.join(home, '.codex', 'plugins', 'cache'),
      'plugin',
      ['codex', 'agent-skills'],
      'codex'
    ),
    // Provider home roots also receive global npx installs; canonical roots alone miss them.
    ...providerHomeSources(home, pathApi, providerRootOverrides)
    // Why: discovery-only agent folders; installs for these agents go to the canonical root.

    // Why: Muse installs to `.agents/skills` but also reads XDG config home.
  ]

  const projectPaths = new Set<string>()
  for (const repo of args.repos ?? []) {
    // Why: runtime-owned repos can have no legacy connectionId while their
    // paths are meaningful only on a remote host.
    if (getRepoExecutionHostId(repo) !== LOCAL_EXECUTION_HOST_ID) {
      continue
    }
    projectPaths.add(repo.path)
  }
  if (args.includeCwd !== false) {
    projectPaths.add(cwd)
  }

  for (const repoPath of projectPaths) {
    const label = `Repo ${pathApi.basename(repoPath)}`
    roots.push(
      source(
        `repo-agents-${stablePathId(repoPath)}`,
        `${label} .agents`,
        pathApi.join(repoPath, '.agents', 'skills'),
        'repo',
        ['agent-skills'],
        null
      ),
      ...providerRepoSources(repoPath, label, pathApi)
      // OpenCode and Qoder also read their own project folders; they install into the canonical root above.
    )
  }

  return roots
}
