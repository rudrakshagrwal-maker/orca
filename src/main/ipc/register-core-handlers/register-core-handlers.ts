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
import { registerMemoryHandlers } from '../memory'
import { registerRateLimitHandlers } from '../rate-limits'
import { registerRuntimeHandlers } from '../runtime'
import {
  invalidateRuntimeEnvironmentTransport,
  registerRuntimeEnvironmentHandlers
} from '../runtime-environments/runtime-environments'
import { registerWslHostHandlers } from '../wsl/wsl-host-handlers'
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
import { isDashboardPopoutRenderer } from '../../window/dashboard-popout-window'
import type { ClaudeUsageStore } from '../../claude-usage/store'
import type { CodexUsageStore } from '../../codex-usage/store'
import type { OpenCodeUsageStore } from '../../opencode-usage/store'
import type { MuseUsageStore } from '../../muse-usage/store'
import type { RateLimitService } from '../../rate-limits/service/rate-limit-service'
import type { CodexAccountService } from '../../codex-accounts/service'
import type { ClaudeAccountService } from '../../claude-accounts/service'
import type { AutomationService } from '../../automations/service'
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
import type { PluginService } from '../../plugins/plugin-service'
import type { PluginMarketplaceHandlerServices } from '../plugin-marketplaces'
import { settleWithinMs } from '../../startup/quit/quit-teardown-deadline'
import { getRuntimeEnvironmentRegistryRoot } from '../runtime-environments/runtime-environment-registry-root'

let registered = false
// Same cap as the restart path's auth preservation: bookkeeping must not hold Restart on a stalled disk.
const RELAUNCH_DISMISSAL_CLOSE_TIMEOUT_MS = 2_000

async function closeNotificationDismissalsBeforeRelaunch(
  runtime: OrcaRuntimeService
): Promise<void> {
  const result = await settleWithinMs(
    runtime.closeNotificationDismissals(),
    RELAUNCH_DISMISSAL_CLOSE_TIMEOUT_MS
  )
  if (result.outcome === 'timed-out') {
    console.warn('[notifications] Relaunching before dismissal recovery state finished saving')
  }
}

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
  _claudeUsage: ClaudeUsageStore,
  _codexUsage: CodexUsageStore,
  _openCodeUsage: OpenCodeUsageStore,
  _museUsage: MuseUsageStore,
  codexAccounts: CodexAccountService,
  claudeAccounts: ClaudeAccountService,
  rateLimits: RateLimitService,
  mainWindowWebContentsId: number | null = null,
  _automations?: AutomationService,
  commitMessageAgentEnv?: CommitMessageAgentEnvironmentResolvers,
  agentAwakeService?: AgentAwakeService,
  crashReports?: CrashReportStore,
  keybindings?: KeybindingService,
  lifecycleOptions: CoreHandlerLifecycleOptions = {},
  _pluginService?: PluginService,
  _marketplaceServices?: PluginMarketplaceHandlerServices
): void {
  // macOS activation can replace the window without ending the app; refresh trusted IDs but register IPC once.
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
    onBeforeRelaunch: lifecycleOptions.onBeforeRelaunch,
    // Restart/profile switching closes this through will-quit; this callback covers relaunch exit.
    onBeforeRelaunchExit: () => closeNotificationDismissalsBeforeRelaunch(runtime)
  })
  registerCliHandlers()
  registerPreflightHandlers(store)
  registerCodexAccountHandlers(codexAccounts, () => store.getSettings())
  registerAgentHookHandlers(runtime, { getPtyIdForPaneKey })
  registerCodexConfigSyncHandlers(codexAccounts.runtimeHomeService)
  registerClaudeAccountHandlers(claudeAccounts)
  registerRateLimitHandlers(rateLimits, codexAccounts)
  registerFeedbackHandlers()
  if (crashReports) {
    registerCrashReportingHandlers(crashReports)
  }
  registerExportHandlers()
  registerStatsHandlers(stats)
  registerMemoryHandlers(store)
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
  registerUIHandlers(store, { isDashboardPopoutRenderer })
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
  configureRuntimeAiVaultSessionDelete((environmentId, args) =>
    deleteRuntimeAiVaultSession(getRuntimeEnvironmentRegistryRoot(), environmentId, args)
  )
  registerClipboardHandlers(store, {
    localChatAttachmentStore: async () => {
      // RA: clipboard support must not eagerly load chat attachment storage.
      const { getAgentSessionAttachmentStore } = await import(
        '../../native-chat/agent-session-attachments/agent-session-attachment-store-registry'
      )
      await ensureStructuredAgentSessionHostUnlessRefused(() =>
        runtime.ensureStructuredAgentSessionHost()
      )
      return getAgentSessionAttachmentStore()
    }
  })
  registerUpdaterHandlers(store)
}
