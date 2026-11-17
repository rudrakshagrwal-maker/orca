import { contextBridge, ipcRenderer } from 'electron'
import { HIDDEN_WINDOW_FRAME_PUMP_STOP_CHANNEL } from '../shared/hidden-window-frame-pump'
import { installHiddenWindowFramePump } from './hidden-window-frame-pump'
import type { DesktopPreloadApi, PreloadApi } from './api-types'
import { installBrowserFindListener } from './preload-runtime-support'
import { appApi } from './api/app-bridge'
import { orcaProfilesApi } from './api/orca-profiles-bridge'
import { platformApi } from './api/platform-bridge'
import { wslApi } from './api/wsl-bridge'
import { wslMoveApi } from './api/wsl-move-bridge'
import { wslDriveProjectApi } from './api/wsl-drive-project-bridge'
import { wslDriveUncConversionApi } from './api/wsl-drive-unc-conversion-bridge'
import { pwshApi } from './api/pwsh-bridge'
import { gitBashApi } from './api/git-bash-bridge'

import { reposApi } from './api/repos-bridge'
import { projectsApi } from './api/projects-bridge'
import { projectGroupsApi } from './api/project-groups-bridge'
import { folderWorkspacesApi } from './api/folder-workspaces-bridge'
import { sparsePresetsApi } from './api/sparse-presets-bridge'
import { worktreesApi } from './api/worktrees-bridge'
import { workspaceCleanupApi } from './api/workspace-cleanup-bridge'

import { linkPreviewApi } from './api/link-preview-bridge'
import { ptyApi } from './api/pty-bridge'
import { feedbackApi } from './api/feedback-bridge'
import { crashReportsApi } from './api/crash-reports-bridge'
import { exportApi } from './api/export-bridge'

import { diagnosticsApi } from './api/diagnostics-bridge'
import { settingsApi } from './api/settings-bridge'
import { agentAwakeApi } from './api/agent-awake-bridge'
import { localhostWorktreeLabelsApi } from './api/localhost-worktree-labels-bridge'
import { keybindingsApi } from './api/keybindings-bridge'
import { codexAccountsApi } from './api/codex-accounts-bridge'
import { claudeAccountsApi } from './api/claude-accounts-bridge'
import { cliApi } from './api/cli-bridge'
import { codexConfigSyncApi } from './api/codex-config-sync-bridge'
import { preflightApi } from './api/preflight-bridge'
import { notificationsApi } from './api/notifications-bridge'

import { terminalPreviewApi } from './api/terminal-preview-bridge'
import { macosTccPromptsApi } from './api/macos-tcc-prompts-bridge'
import { developerPermissionsApi } from './api/developer-permissions-bridge'
import { computerUsePermissionsApi } from './api/computer-use-permissions-bridge'
import { shellApi } from './api/shell-bridge'
import { skillsApi } from './api/skills-bridge'
import { petApi } from './api/pet-bridge'
import { appIconApi } from './api/app-icon-bridge'
import { browserPasswordsApi } from './api/browser-passwords-bridge'
import { browserApi } from './api/browser/browser-bridge'

import { hooksApi } from './api/hooks-bridge'
import { ephemeralVmApi } from './api/ephemeral-vm-bridge'
import { cacheApi } from './api/cache-bridge'
import { sessionApi } from './api/session-bridge'
import { updaterApi } from './api/updater-bridge'
import { docPreviewApi } from './api/doc-preview-bridge'
import { notebookApi } from './api/notebook-bridge'
import { fsApi } from './api/fs-bridge'
import { gitApi } from './api/git-bridge'
import { uiApi } from './api/ui-bridge'
import { statsApi } from './api/stats-bridge'

import { aiVaultApi } from './api/ai-vault-bridge'
import { nativeChatApi } from './api/native-chat-bridge'
import { runtimeApi } from './api/runtime-bridge'
import { runtimeEnvironmentsApi } from './api/runtime-environments-bridge'

import { sshApi } from './api/ssh-bridge'
import { plainSshTerminalApi } from './api/plain-ssh-terminal-bridge'
import { legacyRelayBridgeApi } from './api/legacy-relay-bridge-api'

import { e2eApi } from './api/e2e-bridge'

import { agentStatusApi } from './api/agent-status-bridge'
import { speechApi } from './api/speech-bridge'

installBrowserFindListener()

const telemetryTrackApi: PreloadApi['telemetryTrack'] = (name, props) =>
  ipcRenderer.invoke('telemetry:track', name, props)
const telemetrySetOptInApi: PreloadApi['telemetrySetOptIn'] = (optedIn) =>
  ipcRenderer.invoke('telemetry:setOptIn', optedIn)
const telemetryAcknowledgeBannerApi: PreloadApi['telemetryAcknowledgeBanner'] = () =>
  ipcRenderer.invoke('telemetry:acknowledgeBanner')
const telemetryGetConsentStateApi: PreloadApi['telemetryGetConsentState'] = () =>
  ipcRenderer.invoke('telemetry:getConsentState')

const api = {
  app: appApi,
  orcaProfiles: orcaProfilesApi,
  platform: platformApi,
  wsl: wslApi,
  wslMove: wslMoveApi,
  wslDriveProject: wslDriveProjectApi,
  wslDriveUnc: wslDriveUncConversionApi,
  pwsh: pwshApi,
  gitBash: gitBashApi,

  repos: reposApi,
  projects: projectsApi,
  projectGroups: projectGroupsApi,
  folderWorkspaces: folderWorkspacesApi,
  sparsePresets: sparsePresetsApi,
  worktrees: worktreesApi,
  workspaceCleanup: workspaceCleanupApi,

  linkPreview: linkPreviewApi,
  pty: ptyApi,
  feedback: feedbackApi,
  crashReports: crashReportsApi,
  export: exportApi,

  telemetryTrack: telemetryTrackApi,
  telemetrySetOptIn: telemetrySetOptInApi,
  telemetryAcknowledgeBanner: telemetryAcknowledgeBannerApi,
  telemetryGetConsentState: telemetryGetConsentStateApi,
  diagnostics: diagnosticsApi,
  settings: settingsApi,
  agentAwake: agentAwakeApi,
  localhostWorktreeLabels: localhostWorktreeLabelsApi,
  keybindings: keybindingsApi,
  codexAccounts: codexAccountsApi,
  claudeAccounts: claudeAccountsApi,
  cli: cliApi,
  codexConfigSync: codexConfigSyncApi,
  preflight: preflightApi,
  notifications: notificationsApi,

  terminalPreview: terminalPreviewApi,
  macosTccPrompts: macosTccPromptsApi,
  developerPermissions: developerPermissionsApi,
  computerUsePermissions: computerUsePermissionsApi,
  shell: shellApi,
  skills: skillsApi,
  pet: petApi,
  appIcon: appIconApi,
  browser: browserApi,
  browserPasswords: browserPasswordsApi,

  hooks: hooksApi,
  ephemeralVm: ephemeralVmApi,
  cache: cacheApi,
  session: sessionApi,
  updater: updaterApi,
  docPreview: docPreviewApi,
  notebook: notebookApi,
  fs: fsApi,
  git: gitApi,
  ui: uiApi,
  stats: statsApi,

  aiVault: aiVaultApi,
  nativeChat: nativeChatApi,
  runtime: runtimeApi,
  runtimeEnvironments: runtimeEnvironmentsApi,

  ssh: sshApi,
  plainSsh: plainSshTerminalApi,
  legacyRelayBridge: legacyRelayBridgeApi,

  e2e: e2eApi,

  agentStatus: agentStatusApi,
  speech: speechApi
} satisfies DesktopPreloadApi

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // RA: the desktop exposes its smaller bridge on nonisolated development windows too.
  Object.defineProperty(window, 'api', { value: api, configurable: true })
}

installHiddenWindowFramePump(
  process.argv,
  (stop) => ipcRenderer.once(HIDDEN_WINDOW_FRAME_PUMP_STOP_CHANNEL, stop),
  {
    rootStyle: () => document.documentElement?.style ?? null,
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
    every: (callback, ms) => {
      const handle = window.setInterval(callback, ms)
      return () => window.clearInterval(handle)
    }
  }
)
