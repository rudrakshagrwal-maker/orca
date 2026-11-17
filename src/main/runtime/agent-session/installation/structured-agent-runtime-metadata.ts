import { agentSessionAccountHome } from '../../../../shared/agent-session/lifecycle/agent-session-account-home'
import { applyStructuredCodexWorkspaceTrust } from '../../../agent-launch/trust/agent-workspace-trust-spawn'
import { CODEX_STRUCTURED_AGENT } from '../../../codex/structured/launch/codex-structured-agent-definition'
import { CLAUDE_STRUCTURED_AGENT } from '../../../claude/structured/claude-structured-agent-definition'
import { CLAUDE_CLI_CONVERSATIONS } from '../../../claude/claude-cli-conversations'
import { CODEX_CLI_CONVERSATIONS } from '../../../codex/history/journal-views/codex-cli-conversations'
import { isNativeLocalLocation as supportsCodexStructuredLocation } from '../../../../shared/execution-host'
import { supportsClaudeStructuredLocation } from '../../../claude/structured/launch/claude-structured-location-support'
import { getClaudeProfileRouter } from '../../../claude-accounts/claude-profile-installed-router'
import {
  resolveStructuredClaudeAccountHomePath,
  resolveStructuredCodexAccountHomePath
} from '../environment/structured-agent-account-home'
import {
  claudeModelCatalogDiscovery,
  codexModelCatalogDiscovery
} from '../model-catalog/structured-agent-model-catalog-discovery'
import { resolveStructuredAgentCommand } from '../../../native-chat/structured-agent-command-resolution'
import type {
  StructuredAgentAccountHomeRequest,
  StructuredAgentChatProgram,
  StructuredAgentAccountHomeServices,
  StructuredAgentRuntimeMetadata
} from './structured-agent-runtime-registration-types'

// RA: removed providers never load their adapters or discovery implementations.
export type StructuredAgentRuntimeCatalogEntry = {
  kind: 'codex' | 'claude'
  metadata: StructuredAgentRuntimeMetadata
}

function cliChatProgram(agent: 'claude' | 'codex'): StructuredAgentChatProgram {
  return {
    resolve: (env, commandSettings) => {
      const homePath = env.HOME ?? env.USERPROFILE
      const pathEnv = env.PATH ?? env.Path ?? null
      const options = { pathEnv, ...(homePath ? { homePath } : {}) }
      return { ...resolveStructuredAgentCommand(agent, commandSettings, options), env }
    }
  }
}

async function resolveCodexAccountHomePath(
  request: StructuredAgentAccountHomeRequest,
  services: StructuredAgentAccountHomeServices
): Promise<string> {
  const { launchEnv, purpose, workspacePath, location } = request
  const codexHome = await resolveStructuredCodexAccountHomePath({
    launchEnv,
    resolveLaunchHome:
      purpose === 'launch' ? services.prepareCodexLaunchHome : services.readCodexLaunchHome
  })
  if (purpose === 'launch' && workspacePath) {
    await applyStructuredCodexWorkspaceTrust({
      workspacePath: await workspacePath(),
      launchEnv,
      codexHome,
      settings: services.workspaceTrustSettings(),
      repoDecision: services.workspaceTrustRepoDecision(location)
    })
  }
  return codexHome
}

// One roster supplies both metadata readers and the host's synchronous adapter factories.
export const STRUCTURED_AGENT_RUNTIME_CATALOG: readonly StructuredAgentRuntimeCatalogEntry[] = [
  {
    kind: 'codex',
    metadata: {
      definition: CODEX_STRUCTURED_AGENT,
      chatProgram: cliChatProgram('codex'),
      modelCatalog: codexModelCatalogDiscovery,
      ...CODEX_CLI_CONVERSATIONS,
      supportsLocation: (location) => supportsCodexStructuredLocation(location),
      launchFollowsSelection: () => true,
      resolveAccountHome: async (request, services) =>
        agentSessionAccountHome(
          CODEX_STRUCTURED_AGENT,
          await resolveCodexAccountHomePath(request, services)
        )
    }
  },
  {
    kind: 'claude',
    metadata: {
      definition: CLAUDE_STRUCTURED_AGENT,
      chatProgram: cliChatProgram('claude'),
      modelCatalog: claudeModelCatalogDiscovery,
      ...CLAUDE_CLI_CONVERSATIONS,
      supportsLocation: supportsClaudeStructuredLocation,
      // Without a router a launch keeps the record's home (resolveClaudeStructuredLaunchHome).
      launchFollowsSelection: () => getClaudeProfileRouter() !== undefined,
      resolveAccountHome: async ({ launchEnv, location, purpose }, services) =>
        agentSessionAccountHome(
          CLAUDE_STRUCTURED_AGENT,
          await resolveStructuredClaudeAccountHomePath({
            launchEnv,
            wslDistro: location?.wslDistro ?? null,
            ...(purpose !== 'read' ? { purpose: 'identity' } : {}),
            getClaudeConfigDirectory: services.getClaudeConfigDirectory
          })
        )
    }
  }
]

export const STRUCTURED_AGENT_RUNTIME_METADATA: readonly StructuredAgentRuntimeMetadata[] =
  STRUCTURED_AGENT_RUNTIME_CATALOG.map(({ metadata }) => metadata)

/** The metadata of `agent`, without constructing its adapter or installing the host. */
export function structuredAgentRuntimeMetadata(
  agent: string
): StructuredAgentRuntimeMetadata | null {
  return (
    STRUCTURED_AGENT_RUNTIME_METADATA.find(({ definition }) => definition.agent === agent) ?? null
  )
}
