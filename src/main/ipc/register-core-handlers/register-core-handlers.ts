import { registerBrowserHandlers, setAgentBrowserBridgeRef } from '../browser/browser'
import { setTrustedBrowserRendererWebContentsId } from '../browser/browser-renderer-trust'
import { app } from 'electron'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../../shared/layout-owner-switch'
import { registerAppHandlers } from '../app'
import { registerWslMoveWiring } from '../wsl/wsl-move-driver-wiring'
import { registerWslDriveProjectHandlers } from '../wsl/wsl-drive-project-handlers'
import { installProjectRuntimeGitRouter } from '../../workspaces/execution-host/project-runtime-git-router'
import { registerCliHandlers } from '../cli'
import { registerPreflightHandlers } from '../preflight'
import type { Store } from '../../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { StatsCollector } from '../../stats/collector'
import { registerFilesystemHandlers } from '../filesystem/filesystem'
import type { CommitMessageAgentEnvironmentResolvers } from '../../text-generation/commit-message-agent-environment'
import { registerFilesystemWatcherHandlers } from '../filesystem/watchers/filesystem-watcher-handlers'
import { registerFeedbackHandlers } from '../feedback'
import { registerCrashReportingHandlers } from '../crash-reporting/crash-reporting'
import { registerExportHandlers } from '../export'
import { registerStatsHandlers } from '../stats'

import { registerRuntimeHandlers } from '../runtime'
import {
  invalidateRuntimeEnvironmentTransport,
  registerRuntimeEnvironmentHandlers
} from '../runtime-environments/runtime-environments'
import { registerWslHostHandlers } from '../wsl/wsl-host-handlers'
import { registerSessionSearchActivation } from '../ai-vault/ai-vault-search-activation'
import { registerAiVaultHandlers } from '../ai-vault/ai-vault'
import { registerTerminalPreviewHandlers } from '../terminal-preview'
import { registerDeveloperPermissionHandlers } from '../developer-permissions'
import { registerSessionHandlers } from '../session'
import { registerSettingsHandlers } from '../settings'
import { registerDiagnosticsHandlers } from '../diagnostics'
import { registerKeybindingHandlers } from '../keybindings'
import { registerTelemetryHandlers } from '../telemetry'
import { registerShellHandlers } from '../shell'
import { registerUIHandlers, setTrustedUIRendererWebContentsId } from '../ui'
import { registerTerminalRenderDesyncEvidenceHandler } from '../terminal-render-desync-evidence'
import { registerOrcaProfileHandlers } from '../profiles/orca-profiles'
import { registerCodexAccountHandlers } from '../codex-accounts'
import { registerAgentHookHandlers } from '../agent-hooks'
import { registerCodexConfigSyncHandlers } from '../codex-config-sync'
import { getPtyIdForPaneKey } from '../pty/pane/key-state'
import { registerClaudeAccountHandlers } from '../claude-accounts'
import { registerUpdaterHandlers } from '../../window/attach-main-window-services'
import {
  registerClipboardHandlers,
  setTrustedClipboardRendererWebContentsId
} from '../../window/clipboard-ipc-handlers'

import type { CodexAccountService } from '../../codex-accounts/service'
import type { ClaudeAccountService } from '../../claude-accounts/service'
import type { AgentAwakeService } from '../../power/agent-awake-service'
import type { CrashReportStore } from '../../crash-reporting/reports/crash-report-store'
import type { KeybindingService } from '../../keybindings/keybinding-service'
import type {
  AiVaultPrepareSessionResumeArgs,
  AiVaultPrepareSessionResumeResult
} from '../../../shared/ai-vault/resume/ai-vault-resume-preparation'
import {
  getSavedRuntimeAiVaultHostInfos,
  deleteRuntimeAiVaultSession,
  prepareRuntimeAiVaultSessionResume,
  resolveRuntimeAiVaultSessionTitles,
  scanRuntimeAiVaultSessions
} from '../../ai-vault/runtime-session-scanner'
import { configureRuntimeAiVaultSessionDelete } from '../ai-vault/ai-vault-delete'
import { ensureStructuredAgentSessionHostUnlessRefused } from '../../runtime/agent-session/structured-agent-session-host-refusal'

import { getRuntimeEnvironmentRegistryRoot } from '../runtime-environments/runtime-environment-registry-root'

let registered = false
// RA: removed notification persistence has no relaunch barrier.
type CoreHandlerLifecycleOptions = {
  onBeforeRelaunch?: () => void | Promise<void>
  onOrcaProfileAuthMutation?: () => void
  onBeforeOrcaProfileSignOut?: () => void
  onAfterOrcaProfileSignOut?: () => void
  getAdditionalAiVaultCodexHomePaths?: () => readonly string[]
  prepareAiVaultSessionResume?: (
    args: AiVaultPrepareSessionResumeArgs
  ) => Promise<AiVaultPrepareSessionResumeResult>
}

export function registerCoreHandlers(
  store: Store,
  runtime: OrcaRuntimeService,
  stats: StatsCollector,
  // RA: usage stores are removed from the IPC composition contract.
  codexAccounts: CodexAccountService,
  claudeAccounts: ClaudeAccountService,
  mainWindowWebContentsId: number | null = null,
  commitMessageAgentEnv?: CommitMessageAgentEnvironmentResolvers,
  agentAwakeService?: AgentAwakeService,
  crashReports?: CrashReportStore,
  keybindings?: KeybindingService,
  lifecycleOptions: CoreHandlerLifecycleOptions = {}
): void {
  // macOS activation can replace the window without ending the app; refresh trusted IDs but register IPC once.
  setTrustedBrowserRendererWebContentsId(mainWindowWebContentsId)
  setTrustedClipboardRendererWebContentsId(mainWindowWebContentsId)
  setTrustedUIRendererWebContentsId(mainWindowWebContentsId)
  // RA: disabled IPC implementations are not imported or registered at startup.
  if (registered) {
    return
  }
  registered = true

  registerAppHandlers(store, {
    quitResumeRecordsFor: (session) => runtime.quitResumeRecordsFor(session),
    ...(ORCA_LAYOUT_OWNER_IS_MAIN
      ? {
          reconnectFactsFor: (session, partition) =>
            runtime.shutdownReconnectFactsFor(session, partition)
        }
      : {}),
    onBeforeRelaunch: lifecycleOptions.onBeforeRelaunch
    // Restart/profile switching closes this through will-quit; this callback covers relaunch exit.
  })
  // RA: browser IPC stays live in the lean terminal fork.
  registerBrowserHandlers(store)
  setAgentBrowserBridgeRef(runtime.getAgentBrowserBridge())
  registerCliHandlers()
  registerPreflightHandlers(store)
  registerCodexAccountHandlers(codexAccounts, () => store.getSettings())
  registerAgentHookHandlers(runtime, { getPtyIdForPaneKey })
  registerCodexConfigSyncHandlers(codexAccounts.runtimeHomeService)
  registerClaudeAccountHandlers(claudeAccounts)
  registerFeedbackHandlers()
  if (crashReports) {
    registerCrashReportingHandlers(crashReports)
  }
  registerExportHandlers()
  registerStatsHandlers(stats)
  registerTerminalPreviewHandlers(runtime)
  registerDeveloperPermissionHandlers()
  // Diagnostics and telemetry register independent channels and keep separate data paths.
  registerDiagnosticsHandlers()
  registerTerminalRenderDesyncEvidenceHandler()
  registerSettingsHandlers(store, agentAwakeService)
  // RA: keybindings cannot wake the disabled plugin or automation runtimes.
  if (keybindings) {
    registerKeybindingHandlers(keybindings)
  }
  registerTelemetryHandlers(store)
  registerOrcaProfileHandlers(store, {
    onBeforeRelaunch: lifecycleOptions.onBeforeRelaunch,
    onAuthMutation: lifecycleOptions.onOrcaProfileAuthMutation,
    onBeforeSignOut: lifecycleOptions.onBeforeOrcaProfileSignOut,
    onAfterSignOut: lifecycleOptions.onAfterOrcaProfileSignOut
  })
  registerShellHandlers(store)
  registerSessionHandlers(store, runtime)
  registerUIHandlers(store)
  registerFilesystemHandlers(store, commitMessageAgentEnv)
  registerFilesystemWatcherHandlers()
  registerRuntimeHandlers(runtime)
  registerRuntimeEnvironmentHandlers(store)
  registerWslHostHandlers({
    store,
    getUserDataPath: () => app.getPath('userData'),
    invalidateTransport: invalidateRuntimeEnvironmentTransport
  })
  registerWslMoveWiring(store, runtime)
  registerWslDriveProjectHandlers(store, runtime)
  installProjectRuntimeGitRouter(store)
  // Session history and terminal resume are not chats; a refused host leaves nothing to check.
  const ensureStructuredSessionOwnership = () =>
    ensureStructuredAgentSessionHostUnlessRefused(() => runtime.ensureStructuredAgentSessionHost())
  registerAiVaultHandlers({
    getUserDataPath: () => app.getPath('userData'),
    ensureStructuredSessionOwnership,
    getAdditionalCodexHomePaths: lifecycleOptions.getAdditionalAiVaultCodexHomePaths,
    prepareSessionResume: lifecycleOptions.prepareAiVaultSessionResume,
    getActiveRuntimeAiVaultHostInfos: () =>
      getSavedRuntimeAiVaultHostInfos(getRuntimeEnvironmentRegistryRoot()),
    scanRuntimeAiVaultSessions: async (environmentId, args, options) =>
      scanRuntimeAiVaultSessions(getRuntimeEnvironmentRegistryRoot(), environmentId, args, options),
    resolveRuntimeAiVaultSessionTitles: async (environmentId, args) =>
      resolveRuntimeAiVaultSessionTitles(getRuntimeEnvironmentRegistryRoot(), environmentId, args),
    prepareRuntimeSessionResume: async (environmentId, args) =>
      prepareRuntimeAiVaultSessionResume(getRuntimeEnvironmentRegistryRoot(), environmentId, args)
  })
  registerSessionSearchActivation(store)
  configureRuntimeAiVaultSessionDelete((environmentId, args) =>
    deleteRuntimeAiVaultSession(getRuntimeEnvironmentRegistryRoot(), environmentId, args)
  )
  registerClipboardHandlers(store, {
    localChatAttachmentStore: async () => {
      // RA: clipboard support must not eagerly load chat attachment storage.
      const { getAgentSessionAttachmentStore } =
        await import('../../native-chat/agent-session-attachments/agent-session-attachment-store-registry')
      await ensureStructuredAgentSessionHostUnlessRefused(() =>
        runtime.ensureStructuredAgentSessionHost()
      )
      return getAgentSessionAttachmentStore()
    }
  })
  registerUpdaterHandlers(store)
}
