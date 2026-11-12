import { translateMain } from '../i18n/main-i18n'
import { OrcaRuntimeService } from '../runtime/orca-runtime'
import { getLocalPtyProvider } from '../ipc/pty/provider/registry'
import { clearProviderPtyState } from '../ipc/pty/provider/state-cleanup'
import { agentHookServer } from '../agent-hooks/server/agent-hook-server'
import { toAgentStatusIpcPayload } from '../agent-hooks/server/server-status-identity'
import { loadAgentSessionClaimSigner } from '../runtime/agent-session/ownership/agent-session-claim-identity'
import { getProfileUserDataPath } from '../orca-profiles/profile-storage-paths'
import { codexAiVaultSessionResumePreparation } from '../codex/history/resume/codex-ai-vault-session-resume'
import { prepareCodexPinnedLaunchHome } from './codex-session-resume-launch'
import { resolveHostCodexSessionSourceHome } from '../codex/history/rollouts/codex-session-source-home'
import { agentHookRuntimeDeps } from '../agent-hooks/runtime/agent-hook-runtime-deps'
import { getDaemonProvider } from '../daemon/providers/lifecycle/daemon-provider-state'
import type { TerminalSideEffectBatch } from '../../shared/terminal/output/terminal-side-effect-facts'
import { resolveTuiAgentLaunchEnv } from '../../shared/agent-launch/choices/tui-agent-launch-defaults'
import { callRuntimeEnvironment } from '../ipc/runtime-environments/runtime-environment-transport-routing'
import { createOrchestrationEnvironmentTransport } from '../ipc/runtime-environments/orchestration-environment-transport'
import { trackRuntimeEnvironmentVerifiedTransitions } from '../ipc/runtime-environments/runtime-environment-verified-transitions'
import { onRuntimeEnvironmentStatusPublished } from '../ipc/runtime-environments/runtime-environment-status-owner'
import { mainProcessState as state } from './main-process-state'
import { installWslOrcadAccountShim } from './wsl-orcad-account-env-wiring'
import {
  codexStructuredLaunchHomeResolvers,
  prepareCodexRuntimeHomeForLaunch
} from './codex-launch-preparation'
import { resolveHostAgentBaseEnvironment } from '../runtime/agent-session/environment/structured-agent-shell-environment'
import type { RuntimeDesktopWindowStatus } from '../../shared/runtime-types'
import {
  AgentStatusObservedPaneIdentities,
  recordObservedAgentStatusPaneIdentity
} from '../runtime/terminal/identity/agent-status-observed-pane-identity'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../shared/layout-owner-switch'
import { getRuntimeEnvironmentRegistryRoot } from '../ipc/runtime-environments/runtime-environment-registry-root'

export function getDesktopWindowStatus(): RuntimeDesktopWindowStatus {
  const activation = state.desktopActivationGate
  if (!activation) {
    return 'available'
  }
  const value = activation.getState()
  return value === 'ready' ? 'openable' : value
}

export function initializeMainProcessRuntime(): OrcaRuntimeService {
  const store = state.store
  const stats = state.stats
  if (!store || !stats) {
    throw new Error('Store and stats must be initialized before runtime')
  }
  // Process-scope subscription covers desktop, headless serve and fleet status.
  const observedPaneIdentities = new AgentStatusObservedPaneIdentities()
  const runtime = new OrcaRuntimeService(store, stats, {
    getSetupTerminalTitle: () => translateMain('worktree.setupTerminalTitle', 'Setup'),
    ...agentHookRuntimeDeps(agentHookServer, observedPaneIdentities, () =>
      state.store?.getSettings()
    ),
    prepareClaudeAuth: (target) => state.claudeRuntimeAuth!.prepareForClaudeLaunch(target),
    agentSessionClaimSigner: loadAgentSessionClaimSigner(
      getProfileUserDataPath(),
      getProfileUserDataPath()
    ),
    // Resolve provider lazily or later daemon adoption leaves a frozen pre-daemon reference (design §4.3).
    getLocalProvider: () => getLocalPtyProvider(),
    onPtyStopped: clearProviderPtyState,
    // Serve can activate in place; wire now, but enable desktop scanners only for a ready renderer.
    onTerminalSideEffects: (batch: TerminalSideEffectBatch) => {
      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('pty:sideEffect', batch)
      }
    },
    getDesktopWindowStatus,
    attestAgentHookCompatibilityAuthority: (candidate) =>
      agentHookServer.attestCompatibilityAuthority(candidate),
    retireAgentHookCompatibilityAuthority: (paneKey) =>
      agentHookServer.retirePaneAuthority(paneKey),
    canRecoverPersistentLocalPtys: () => getDaemonProvider() !== null,
    // Resolve per call: the RPC server/device registry is constructed later with this runtime.
    getPairedDeviceName: (pairedDeviceId) =>
      state.runtimeRpc?.getDeviceRegistry()?.getDevice(pairedDeviceId)?.name ?? null,
    // Provide managed Codex homes here for desktop and headless session discovery; core IPC registration is window-only.
    getAdditionalAiVaultCodexHomePaths: () =>
      state.codexRuntimeHome?.getHostCodexHomePathsForSessionDiscovery() ?? [],
    prepareAiVaultSessionResume: codexAiVaultSessionResumePreparation(() => ({
      runtimeHome: state.codexRuntimeHome,
      systemCodexHomePath: resolveHostCodexSessionSourceHome(store.getSettings()),
      preparePinnedLaunchHome: (home) => prepareCodexPinnedLaunchHome(home)
    })),
    ...codexStructuredLaunchHomeResolvers,
    prepareCodexCatalogProbeHome: (homePath) =>
      state.codexRuntimeHome?.prepareHostCodexHomeForReadOnlyAppServer(
        homePath,
        resolveTuiAgentLaunchEnv('codex', store.getSettings())
      ),
    orchestrationEnvironmentTransport: {
      ...createOrchestrationEnvironmentTransport(),
      onEnvironmentVerified: (listener) =>
        onRuntimeEnvironmentStatusPublished(trackRuntimeEnvironmentVerifiedTransitions(listener))
    },
    workspaceSleepPlatform: {
      callEnvironment: (environmentId, method, params, timeoutMs) =>
        callRuntimeEnvironment(
          getRuntimeEnvironmentRegistryRoot(),
          environmentId,
          method,
          params,
          timeoutMs
        ),
      // RA: retain remote workspace transport without importing a local VM lifecycle.
      ownsVm: () => false,
      suspendVm: async () => {
        throw new Error('VM workspaces are disabled')
      },
      acceptWake: () => {
        throw new Error('VM workspaces are disabled')
      },
      resumeVm: async () => null
    },
    skillTransactionRecovery: state.skillTransactionRecovery
  })
  // RA: no search indexer, downloaded status rules, VM or hosted-review startup imports.
  state.runtime = runtime
  runtime.attachAgentStatusStore(agentHookServer)
  agentHookServer.subscribeEnrichedStatus((enriched) =>
    recordObservedAgentStatusPaneIdentity(observedPaneIdentities, enriched, runtime)
  )
  agentHookServer.setCliWriterExecutionMatcher(observedPaneIdentities, runtime)
  agentHookServer.setClaudePermissionHolds(runtime.terminalWorkerApprovals)
  // Main records pane resume state from accepted status.
  if (ORCA_LAYOUT_OWNER_IS_MAIN) {
    agentHookServer.subscribeEnrichedStatus((enriched) =>
      runtime.recordHookStatusResume(toAgentStatusIpcPayload(enriched))
    )
    agentHookServer.subscribePaneStatusClear((clear) => runtime.forgetHookStatusResume(clear))
    agentHookServer.subscribeStatusDrop((paneKey) => runtime.forgetHookStatusResume({ paneKey }))
  }
  runtime.startupWorkerAuthority.begin()
  return runtime
}

export function configureRuntimeServices(runtime: OrcaRuntimeService): void {
  const store = state.store
  const claudeAccounts = state.claudeAccounts
  const codexAccounts = state.codexAccounts
  const rateLimits = state.rateLimits
  if (!store || !claudeAccounts || !codexAccounts || !rateLimits) {
    throw new Error('Account services must be initialized before runtime wiring')
  }
  // RA: only terminal account and launch services are constructed.
  runtime.setAccountServices({ claudeAccounts, codexAccounts, rateLimits })
  installWslOrcadAccountShim(store)
  runtime.setCommitMessageAgentEnvironmentResolvers({
    // Resolve every Codex launch through runtime-home, including default-account hooks/auth.
    prepareForCodexLaunch: prepareCodexRuntimeHomeForLaunch,
    prepareForClaudeLaunch: (target) => state.claudeRuntimeAuth!.prepareForClaudeLaunch(target),
    resolveBaseEnvironment: () => resolveHostAgentBaseEnvironment(store.getSettings())
  })
}
