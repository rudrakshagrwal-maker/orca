// RA: web clients expose the same retained features without removed provider bridges.
import type { PreloadApi } from '../../../preload/api-types'
import type { StatsSummary } from '../../../shared/process-stats-types'
import { createWebE2EApi } from './preload-api/web-e2e-api'
import {
  createClaudeAccountsApi,
  createCodexAccountsApi
} from './preload-api/web-agent-accounts-api'
import { createWebAgentStatusApi } from './preload-api/web-agent-status-api'
import { createWebAiVaultApi } from './preload-api/web-ai-vault-api'
import { createWebAppApi } from './preload-api/web-app-api'
import { createBrowserApi } from './preload-api/web-browser-api'
import { createCliApi } from './preload-api/web-cli-api'
import { createWebDiagnosticsApi } from './preload-api/web-diagnostics-api'
import { withFallback } from './preload-api/web-fallback-api'
import { createFileApi } from './preload-api/web-filesystem-api'
import { createGitApi } from './preload-api/web-git-api'

import {
  createComputerUsePermissionsApi,
  createDeveloperPermissionsApi,
  createPreflightApi
} from './preload-api/web-host-capability-api'
import { createWebKeybindingsApi } from './preload-api/web-keybindings-api'
import { createMacosTccPromptsApi } from './preload-api/web-macos-tcc-api'

import { createWebNativeChatApi } from './preload-api/web-native-chat-api'

import { createWebOrcaProfilesApi } from './preload-api/web-orca-profiles-api'
import { createWebPlatformApi } from './preload-api/web-platform-api'

import { createReposApi } from './preload-api/web-repositories-api'
import { createHooksApi } from './preload-api/web-review-api'

import { callRuntimeResult } from './preload-api/web-runtime-calls'
import { createWebRuntimeApi } from './preload-api/web-runtime-api'
import { createRuntimeEnvironmentsApi } from './preload-api/web-runtime-environments-api'
import { webRuntimeState } from './preload-api/web-runtime-session'
import { createWebSettingsApi } from './preload-api/web-settings-api'
import { createShellApi } from './preload-api/web-shell-api'
import { createWebSpeechApi } from './preload-api/web-speech-api'

import { createWebTelemetryApi } from './preload-api/web-telemetry-api'
import { createPtyApi, createSshApi } from './preload-api/web-terminal-api'
import { createWebUiApi } from './preload-api/web-ui-api'
import { createUpdaterApi } from './preload-api/web-updater-api'

import { createWebLinkPreviewApi } from './preload-api/web-link-preview-api'
import { createWebWorkspaceSessionApi } from './preload-api/web-workspace-session-api'
import { createWorktreesApi } from './preload-api/web-worktrees-api'
import { readStoredWebRuntimeEnvironment } from './web-runtime-environment'

export function installWebPreloadApi(): void {
  webRuntimeState.activeEnvironment = readStoredWebRuntimeEnvironment()
  const webWindow = window as unknown as { __ORCA_WEB_CLIENT__?: boolean }
  webWindow.__ORCA_WEB_CLIENT__ = true
  window.api = withFallback(createWebPreloadApi(), []) as PreloadApi
}

function createWebPreloadApi(): Omit<Partial<PreloadApi>, 'settings' | 'speech'> & {
  settings: Partial<PreloadApi['settings']>
  speech: Partial<PreloadApi['speech']>
} {
  return {
    ...createWebAppApi(),

    ...createWebPlatformApi(),

    linkPreview: createWebLinkPreviewApi(),
    ...createWebOrcaProfilesApi(),
    ...createWebE2EApi(),
    ...createWebSettingsApi(),
    keybindings: createWebKeybindingsApi(),
    ui: createWebUiApi(),

    ...createWebDiagnosticsApi(),
    ...createWebWorkspaceSessionApi(),

    runtime: createWebRuntimeApi(),
    nativeChat: createWebNativeChatApi(),
    speech: createWebSpeechApi(),
    runtimeEnvironments: createRuntimeEnvironmentsApi(),
    repos: createReposApi(),
    worktrees: createWorktreesApi(),
    fs: createFileApi(),
    git: createGitApi(),
    browser: createBrowserApi(),

    hooks: createHooksApi(),
    stats: {
      getSummary: async () =>
        callRuntimeResult<StatsSummary>('stats.summary').catch(() => ({
          totalAgentsSpawned: 0,
          totalPRsCreated: 0,
          totalAgentTimeMs: 0,
          firstEventAt: null
        }))
    },

    aiVault: createWebAiVaultApi(),
    preflight: createPreflightApi(),

    codexAccounts: createCodexAccountsApi(),
    claudeAccounts: createClaudeAccountsApi(),
    cli: createCliApi(),
    macosTccPrompts: createMacosTccPromptsApi(),
    codexConfigSync: {
      status: () =>
        Promise.resolve({ state: 'synced', reason: null, systemConfigPath: '' } as const)
    },
    developerPermissions: createDeveloperPermissionsApi(),
    computerUsePermissions: createComputerUsePermissionsApi(),
    updater: createUpdaterApi(),
    shell: createShellApi(),

    pty: createPtyApi(),
    ssh: createSshApi(),
    wsl: {
      isAvailable: () => callRuntimeResult<boolean>('host.wsl.isAvailable').catch(() => false),
      listDistros: () => callRuntimeResult<string[]>('host.wsl.listDistros').catch(() => [])
    },
    // Desktop-only: a web client never owns a WSL move's desktop stores.
    wslMove: {
      listPendingRendererRewrites: () => Promise.resolve([]),
      recordStoreRewritten: () => Promise.resolve({ recorded: false, reason: 'gated-off' }),
      preview: () => Promise.resolve({ outcome: 'refused', code: 'wsl_move_unavailable' }),
      start: () => Promise.resolve({ outcome: 'refused', code: 'wsl_move_unavailable' }),
      cancel: () => Promise.resolve(false),
      listUnfinished: () => Promise.resolve([]),
      isRunning: () => Promise.resolve(false),
      useProjectHereAgain: () => Promise.resolve({ released: false, reason: 'gated-off' }),
      onProgress: () => () => {},
      listOrchestrator: () => Promise.resolve([]),
      orchestratorUserAction: () => Promise.resolve(null),
      orchestratorProjectOpened: () => Promise.resolve(),
      onOrchestratorStatus: () => () => {},
      onOrchestratorSleptPanesRequest: () => () => {},
      answerOrchestratorSleptPanes: () => Promise.resolve()
    },
    // Desktop-only: a web client never converts this computer's projects.
    wslDriveUnc: {
      convert: () => Promise.resolve({ outcome: 'refused', blockers: [] }),
      listPendingRendererRewrites: () => Promise.resolve([]),
      recordStoreRewritten: () => Promise.resolve({ recorded: false, reason: 'gated-off' })
    },
    pwsh: {
      isAvailable: () => callRuntimeResult<boolean>('host.pwsh.isAvailable').catch(() => false)
    },
    gitBash: {
      isAvailable: () => callRuntimeResult<boolean>('host.gitBash.isAvailable').catch(() => false)
    },
    ...createWebAgentStatusApi(),

    ...createWebTelemetryApi()
  }
}
