import { agentSessionAttachmentStoreRoot } from '../../../native-chat/agent-session-attachments/agent-session-attachment-references'
import { withSupportedCodexCli } from '../../../codex/structured/launch/codex-cli-installation-error'
import { codexStructuredLaunchPart } from '../../../codex/structured/launch/codex-structured-launch-resolution'
import { claudeStructuredLaunchPart } from '../../../claude/structured/launch/claude-structured-launch-resolution'
import { claudeNamingInvocation } from '../../../claude/claude-naming-invocation'
import { createClaudeCommandCatalogProbe } from '../../../claude/claude-command-catalog-probe'
import { CodexStructuredSessionAdapter } from '../../../codex/structured/session-lifecycle/codex-structured-session-adapter'
import { createCodexAtRestSkillCatalog } from '../../../codex/structured/catalog/codex-at-rest-skills-probe'
import { CODEX_STRUCTURED_AGENT } from '../../../codex/structured/launch/codex-structured-agent-definition'
import { CLAUDE_STRUCTURED_AGENT } from '../../../claude/structured/claude-structured-agent-definition'
import { agentModelCatalogStore } from '../../../native-chat/agent-model-catalog/agent-model-catalog-store'
import { createStructuredClaudeRuntimeAdapter } from './structured-claude-runtime-adapter'
import {
  claudeLaunchEnvOverlay,
  claudeListingDeps
} from '../model-catalog/structured-agent-model-catalog-discovery'
import {
  composeStructuredLaunch,
  structuredAgentLaunchSources
} from '../launch/structured-agent-launch-composition'
import {
  STRUCTURED_AGENT_RUNTIME_CATALOG,
  type StructuredAgentRuntimeCatalogEntry
} from './structured-agent-runtime-metadata'
import type {
  StructuredAgentAdapterContext,
  StructuredAgentRuntimeAdapter,
  StructuredAgentRuntimeRegistration
} from './structured-agent-runtime-registration-types'

function createCodexAdapter(context: StructuredAgentAdapterContext): StructuredAgentRuntimeAdapter {
  const { deps, followUps, host } = context
  const providerInvocation = {
    resolveLaunchArgs: () => deps.resolveLaunchArgs('codex'),
    resolveWorkspacePath: deps.resolveWorkspacePath,
    resolveEnvironment: () => context.environment.resolveAgentEnvironment('codex'),
    refreshEnvironmentAfterMiss: context.environment.refreshAfterMissingProgram,
    ...(deps.resolveCodexCommand ? { resolveCommand: deps.resolveCodexCommand } : {})
  }
  return new CodexStructuredSessionAdapter({
    providerInvocation,
    resolveAccountKind: deps.resolveCodexAccountKind,
    atRestCommands: createCodexAtRestSkillCatalog({
      ...providerInvocation,
      ...(deps.prepareCodexCatalogProbeHome
        ? { prepareHome: deps.prepareCodexCatalogProbeHome }
        : {})
    }),
    resolveLaunch: withSupportedCodexCli(
      composeStructuredLaunch(
        CODEX_STRUCTURED_AGENT,
        structuredAgentLaunchSources(context),
        codexStructuredLaunchPart({
          resolveLaunchArgs: () => deps.resolveLaunchArgs('codex'),
          ...(deps.prepareLaunchAccountHome
            ? { prepareLaunchAccountHome: deps.prepareLaunchAccountHome }
            : {}),
          ...(deps.resolveCodexCommand ? { resolveCommand: deps.resolveCodexCommand } : {})
        })
      ),
      deps.readCodexInstallation
    ),
    ...(deps.openCodexConnection ? { openConnection: deps.openCodexConnection } : {}),
    ...(deps.readProcessStartTime ? { readProcessStartTime: deps.readProcessStartTime } : {}),
    modelCatalog: agentModelCatalogStore,
    readModelCatalog: (sessionId, verifiedOnly) =>
      host()?.deps.modelCatalog?.peek(sessionId, verifiedOnly) ?? null,
    demandModelCatalog: async (sessionId, legacy) =>
      host()?.deps.modelCatalog?.demand({
        agent: 'codex',
        sessionId,
        ...(legacy ? { legacy: true } : {})
      }),
    onChildWorkEvidence: (sessionId, evidence, producer) =>
      host()?.publishChildWorkEvidence(sessionId, evidence, producer),
    onDispatchSettledLate: followUps.onDispatchSettledLate,
    // After the frame being read: what the child holds is re-derived, never published mid-frame.
    onHeldSendsChanged: ({ sessionId }) =>
      queueMicrotask(() => host()?.publishWorkChanged(sessionId)),
    logger: deps.logger,
    onEvent: (event) => {
      // Every exit, expected or not: the host ends that child's record.
      if (event.type === 'options-reported' || (event.type === 'ended' && 'cause' in event)) {
        context.deliverLifecycle(event)
      }
    }
  })
}

function createClaudeAdapter(
  context: StructuredAgentAdapterContext
): StructuredAgentRuntimeAdapter {
  const { deps, store, followUps, host } = context
  const overlay = claudeLaunchEnvOverlay(deps).resolveEnv
  const resolveAccountHome = deps.resolveAgentAccountHome
  return createStructuredClaudeRuntimeAdapter({
    store,
    namingInputs: claudeNamingInvocation(
      structuredAgentLaunchSources(context),
      () => deps.resolveLaunchArgs('claude'),
      deps.resolveClaudeCommand
    ),
    resolveWorkspacePath: deps.resolveWorkspacePath,
    ...(resolveAccountHome ? { resolveAccountHome: () => resolveAccountHome('claude') } : {}),
    resolveLaunch: composeStructuredLaunch(
      CLAUDE_STRUCTURED_AGENT,
      structuredAgentLaunchSources(context),
      claudeStructuredLaunchPart({
        resolveLaunchArgs: () => deps.resolveLaunchArgs('claude'),
        ...(deps.resolveClaudeCommand ? { resolveCommand: deps.resolveClaudeCommand } : {}),
        resolveAuthPolicy: deps.resolveClaudeAuthPolicy,
        attachmentDirectory: agentSessionAttachmentStoreRoot(deps.stateDirectory),
        ...(deps.claudeCliFlags ? { cliFlags: deps.claudeCliFlags } : {})
      })
    ),
    ...(deps.resolveClaudeCommand ? { resolveClaudeCommand: deps.resolveClaudeCommand } : {}),
    ...(deps.claudeCliFlags ? { claudeCliFlags: deps.claudeCliFlags } : {}),
    ...(overlay ? { resolveClaudeLaunchEnv: overlay } : {}),
    resolveClaudeInheritedEnv: context.environment.resolveBaseEnvironment,
    atRestCommandProbe: createClaudeCommandCatalogProbe(claudeListingDeps(context)),
    onLifecycleEvent: context.deliverLifecycle,
    logger: deps.logger,
    onChildWorkEvidence: (sessionId, evidence, producer) =>
      host()?.publishChildWorkEvidence(sessionId, evidence, producer),
    onDispatchSettledLate: followUps.onDispatchSettledLate,
    ...(deps.openClaudeConnection ? { openClaudeConnection: deps.openClaudeConnection } : {}),
    ...(deps.readProcessStartTime ? { readProcessStartTime: deps.readProcessStartTime } : {})
  })
}

// RA: adapter construction is limited to Claude and Codex.
function registrationWithAdapter(
  entry: StructuredAgentRuntimeCatalogEntry
): StructuredAgentRuntimeRegistration {
  // Keep overrides visible through both the metadata and full-registration views.
  switch (entry.kind) {
    case 'codex':
      return Object.assign(entry.metadata, { createAdapter: createCodexAdapter })
    case 'claude':
      return Object.assign(entry.metadata, { createAdapter: createClaudeAdapter })
  }
}

export const STRUCTURED_AGENT_RUNTIME_REGISTRATIONS: readonly StructuredAgentRuntimeRegistration[] =
  STRUCTURED_AGENT_RUNTIME_CATALOG.map(registrationWithAdapter)

/** The registration of `agent`; null for an agent this runtime does not drive. */
export function structuredAgentRuntimeRegistration(
  agent: string
): StructuredAgentRuntimeRegistration | null {
  return (
    STRUCTURED_AGENT_RUNTIME_REGISTRATIONS.find(({ definition }) => definition.agent === agent) ??
    null
  )
}
