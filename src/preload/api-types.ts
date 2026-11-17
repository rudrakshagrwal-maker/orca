import type {
  ClaudeAccountsApi,
  CodexAccountsApi,
  CodexConfigSyncApi
} from './api/agent-account-api'
import type { HooksApi } from './api/agent-hook-api'
import type { SkillsApi } from './api/agent-skill-api'
import type { AgentAwakeApi, AgentStatusApi } from './api/agent-status-api'

import type { AiVaultApi } from './api/ai-vault-api'
import type { AppApi, E2EApi, PlatformApi } from './api/app-api'

import type { BrowserApi } from './api/browser/browser-api'
import type { CliApi } from './api/cli-install-api'
import type { CrashReportsApi, FeedbackApi } from './api/crash-report-api'
import type { TerminalPreviewApi } from './api/dashboard-api'
import type { DocPreviewApi } from './api/doc-preview-api'

import type { EphemeralVmApi } from './api/ephemeral-vm-api'
import type { ExportApi, FilesystemApi } from './api/filesystem-api'
import type { GitInspectionApi } from './api/git-inspection-api'
import type { GitOperationApi } from './api/git-operation-api'

import type { NativeChatApi } from './api/native-chat-api'

import type { OrcaProfileApi } from './api/orca-profile-api'
import type {
  ComputerUsePermissionsApi,
  DeveloperPermissionsApi,
  MacosTccPromptsApi,
  NotificationsApi
} from './api/os-permission-api'
import type { PetApi } from './api/pet-api'
import type { AppIconApi } from './api/app-icon-api'
import type { BrowserPasswordsApi } from './api/browser-passwords-api'

import type { PreflightApi } from './api/preflight-api'
import type { PtyApi } from './api/pty-api'
import type { ProjectGroupsApi, ProjectsApi, RepositoryApi } from './api/repository-api'
import type { RuntimeApi } from './api/runtime-api'
import type { WslMoveApi } from './api/wsl-move-bridge'
import type { WslDriveProjectApi } from './api/wsl-drive-project-bridge'
import type { WslDriveUncConversionApi } from './api/wsl-drive-unc-conversion-bridge'
import type { KeybindingsApi, SettingsApi } from './api/settings-api'
import type { ShellApi } from './api/shell-api'
import type { SpeechApi } from './api/speech-api'
import type { SshApi } from './api/ssh-api'
import type { PlainSshTerminalApi } from './api/plain-ssh-terminal-bridge'
import type { LegacyRelayBridgeApi } from './api/legacy-relay-bridge-api'
import type { DiagnosticsApi, StatsApi, TelemetryApi } from './api/telemetry-api';
import type { UiCommandEventApi } from './api/ui-command-event-api'
import type { UiWindowApi } from './api/ui-window-api'
import type { UpdaterApi } from './api/updater-api'
import type { WorkspaceCleanupApi } from './api/workspace-cleanup-api'
import type { LocalhostWorktreeLabelsApi } from './api/workspace-port-api'
import type { LinkPreviewApi } from './api/link-preview-api'
import type { WorkspaceSessionApi } from './api/workspace-session-api'
import type { FolderWorkspacesApi, SparsePresetsApi, WorktreeApi } from './api/worktree-api'

// Flattens contracts that share one PreloadApi key: an intersection is not type-identical to the flat shape.
type Merged<T> = { [K in keyof T]: T[K] }

export type PreloadApi = {
  app: AppApi
  orcaProfiles: OrcaProfileApi
  platform: PlatformApi
  e2e: E2EApi
  repos: RepositoryApi
  projects: ProjectsApi
  projectGroups: ProjectGroupsApi
  folderWorkspaces: FolderWorkspacesApi
  sparsePresets: SparsePresetsApi
  worktrees: WorktreeApi
  workspaceCleanup: WorkspaceCleanupApi

  linkPreview: LinkPreviewApi
  pty: PtyApi
  feedback: FeedbackApi
  crashReports: CrashReportsApi
  export: ExportApi

  telemetryTrack: TelemetryApi['telemetryTrack']
  telemetrySetOptIn: TelemetryApi['telemetrySetOptIn']
  diagnostics: DiagnosticsApi
  telemetryGetConsentState: TelemetryApi['telemetryGetConsentState']
  telemetryAcknowledgeBanner: TelemetryApi['telemetryAcknowledgeBanner']
  settings: SettingsApi
  agentAwake: AgentAwakeApi
  localhostWorktreeLabels: LocalhostWorktreeLabelsApi
  keybindings: KeybindingsApi
  codexAccounts: CodexAccountsApi
  claudeAccounts: ClaudeAccountsApi
  cli: CliApi
  codexConfigSync: CodexConfigSyncApi
  preflight: PreflightApi
  notifications: NotificationsApi

  terminalPreview: TerminalPreviewApi
  macosTccPrompts: MacosTccPromptsApi
  developerPermissions: DeveloperPermissionsApi
  computerUsePermissions: ComputerUsePermissionsApi
  shell: ShellApi
  skills: SkillsApi
  pet: PetApi
  appIcon: AppIconApi
  browser: BrowserApi
  browserPasswords: BrowserPasswordsApi

  hooks: HooksApi
  ephemeralVm: EphemeralVmApi
  cache: WorkspaceSessionApi['cache']
  session: WorkspaceSessionApi['session']
  updater: UpdaterApi
  notebook: FilesystemApi['notebook']
  docPreview: DocPreviewApi['docPreview']
  stats: StatsApi

  aiVault: AiVaultApi
  nativeChat: NativeChatApi
  fs: FilesystemApi['fs']
  git: Merged<GitInspectionApi & GitOperationApi>
  ui: Merged<UiCommandEventApi & UiWindowApi>
  runtime: RuntimeApi['runtime']
  runtimeEnvironments: RuntimeApi['runtimeEnvironments']

  ssh: SshApi
  /** Desktop only: an unmanaged ssh login to a host whose move is blocked. */
  plainSsh?: PlainSshTerminalApi
  /** COMPAT(legacy-relay-bridge): desktop-only, revisit 2027-01-15. */
  legacyRelayBridge?: LegacyRelayBridgeApi

  wsl: RuntimeApi['wsl']
  wslMove: WslMoveApi
  wslDriveProject: WslDriveProjectApi
  wslDriveUnc: WslDriveUncConversionApi
  pwsh: RuntimeApi['pwsh']
  gitBash: RuntimeApi['gitBash']

  agentStatus: AgentStatusApi

  speech: SpeechApi
}

export type { AiVaultApi } from './api/ai-vault-api'

export type { AppApi } from './api/app-api'
export type {
  BrowserApi,
  DetectedBrowserInfo,
  DetectedBrowserProfileInfo
} from './api/browser/browser-api'

export type { ExportApi } from './api/filesystem-api'
export type {
  NativeChatApi,
  NativeChatAppendedMessages,
  NativeChatAppendedPayload,
  NativeChatReadSessionResult,
  NativeChatSubscribeArgs,
  NativeChatSubscriptionFrame
} from './api/native-chat-api'

export type {
  PreflightApi,
  PreflightRuntimeContext,
  PreflightStatus,
  RefreshAgentsResult
} from './api/preflight-api'
export type {
  PtyManagementApi,
  PtyManagementDaemonCwdClass,
  PtyManagementFolderAccessMismatch,
  PtyManagementMacTccAttributionHealth,
  PtyManagementSession,
  PtyManagementSeveredDaemon,
  PtyManagementSeveredDaemonRestartResult
} from './api/pty-management-api'

export type {
  DiagnosticsBundlePayload,
  DiagnosticsStatusPayload,
  DiagnosticsUploadPayload,
  StatsApi
} from './api/telemetry-api'

declare global {
  // oxlint-disable-next-line typescript-eslint/consistent-type-definitions -- declaration merging requires interface
  interface Window {
    api: PreloadApi
  }
}

// RA: desktop omits deleted bridges; the wider contract remains shared with remote clients.
export type DesktopPreloadApi = Omit<
  PreloadApi,
  | 'plugins'
  | 'workspacePorts'
  | 'linear'
  | 'jira'
  | 'starNag'
  | 'onboarding'
  | 'dashboard'
  | 'emulator'
  | 'claudeUsage'
  | 'codexUsage'
  | 'openCodeUsage'
  | 'museUsage'
  | 'opencodeGoCredentials'
  | 'minimaxCredentials'
  | 'zcodePlanCredentials'
  | 'grokAccounts'
  | 'cursorAccounts'
  | 'automations'
  | 'mobile'
  | 'memory'
  | 'rateLimits'
  | 'ui'
  | 'workspaceSpace'
> & { ui: DesktopUiApi }

// RA: removed UI destinations have no desktop IPC listeners or invoke bridge.
export type DesktopUiApi = Omit<
  PreloadApi['ui'],
  | 'getJiraQuickFilters'
  | 'setJiraQuickFilters'
  | 'getJiraSavedFilters'
  | 'mutateJiraSavedFilters'
  | 'onOpenSkillShare'
  | 'consumePendingSkillShare'
  | 'onOpenPluginInstallLink'
  | 'consumePendingPluginInstallLink'
  | 'onOpenSetupGuide'
  | 'onOpenFeatureTour'
  | 'onToggleRightSidebar'
  | 'onToggleWorktreePalette'
  | 'onToggleFloatingTerminal'
  | 'onOpenNewWorkspace'
  | 'onOpenWorkspaceBoard'
  | 'onOpenTasks'
  | 'onToggleAgentDashboard'
>
