import { backgroundJobsDisabled } from '../../shared/fork-background-policy'
import type { BrowserWindow } from 'electron'
import { registerCoreHandlers } from '../ipc/register-core-handlers/register-core-handlers'
import { attachMainWindowServices } from '../window/attach-main-window-services'
import { initTccPromptNotice } from '../macos-permissions/macos-tcc-prompt-notice'
import { resolveUpdateInstallMode } from '../updater/updater-service'
import { desktopConnectorCloud } from './main-process-connector-startup'
import { mainProcessState as state } from './main-process-state'
import { prepareCodexAiVaultSessionResume } from '../codex/history/resume/codex-ai-vault-session-resume'
import { resolveHostCodexSessionSourceHome } from '../codex/history/rollouts/codex-session-source-home'
import { preserveAgentAuthBeforeRestart } from '../providers/accounts/agent-auth-restart-preservation'
import { preserveStateBeforeUpdateRestart } from '../updater/update-restart-preservation'
import { handleCodexHomePtySpawned, handlePtyExit } from './main-process-pty-startup'
import { prepareCodexRuntimeHomeForLaunch } from './codex-launch-preparation'
import { resolveHostAgentBaseEnvironment } from '../runtime/agent-session/environment/structured-agent-shell-environment'
import {
  prepareCodexPinnedLaunchHome,
  prepareCodexSessionResumeForLaunch
} from './codex-session-resume-launch'
import { isRecoveryReloadInFlight } from './main-window-lifecycle-flags'

import { holdLaunchReconnectOptOuts } from '../ipc/ssh/ssh-host-user-disconnect'

export function attachMainWindowCoreServices(
  window: BrowserWindow,
  deps: {
    markExpectedRendererReload: (webContentsId: number) => void
    recordRendererReload: (ignoreCache: boolean) => void
  }
): void {
  const store = state.store
  const runtime = state.runtime
  const stats = state.stats
  // RA: the window depends on authentication only, without any usage service.
  const codexAccounts = state.codexAccounts
  const claudeAccounts = state.claudeAccounts
  const keybindings = state.keybindings
  const codexRuntimeHome = state.codexRuntimeHome
  const claudeRuntimeAuth = state.claudeRuntimeAuth
  if (
    !store ||
    !runtime ||
    !stats ||
    !codexAccounts ||
    !claudeAccounts ||
    !keybindings ||
    !codexRuntimeHome ||
    !claudeRuntimeAuth
  ) {
    throw new Error('Main window services must be initialized before attaching')
  }
  // Server status probes start inside registerCoreHandlers; held hosts must be marked first.
  holdLaunchReconnectOptOuts(store.getSshTargets())
  registerCoreHandlers(
    store,
    runtime,
    stats,
    codexAccounts,
    claudeAccounts,
    window.webContents.id,
    {
      prepareForCodexLaunch: prepareCodexRuntimeHomeForLaunch,
      prepareForClaudeLaunch: (target) => claudeRuntimeAuth.prepareForClaudeLaunch(target),
      resolveBaseEnvironment: () => resolveHostAgentBaseEnvironment(store.getSettings())
    },
    state.agentAwakeService ?? undefined,
    state.crashReports ?? undefined,
    keybindings,
    {
      getAdditionalAiVaultCodexHomePaths: () =>
        codexRuntimeHome.getHostCodexHomePathsForSessionDiscovery(),
      prepareAiVaultSessionResume: (args) =>
        prepareCodexAiVaultSessionResume(args, {
          runtimeHome: codexRuntimeHome,
          systemCodexHomePath: resolveHostCodexSessionSourceHome(store.getSettings()),
          preparePinnedLaunchHome: (home) => prepareCodexPinnedLaunchHome(home)
        }),
      onBeforeRelaunch: async () => {
        state.isQuitting = true
        desktopConnectorCloud()?.fence()
        await preserveAgentAuthBeforeRestart({ codexRuntimeHome, store })
      },
      onOrcaProfileAuthMutation: () => {
        // An auth change retries relay installation after launch-time failure.
        desktopConnectorCloud()?.accountChanged()
      },
      // Only sign-out fences paired phones; reasonless quit/relaunch must not look like logout.
      onBeforeOrcaProfileSignOut: () => {
        desktopConnectorCloud()?.signOutStarted()
      },
      onAfterOrcaProfileSignOut: () => desktopConnectorCloud()?.signOutFinished()
    }
  )
  // RA: no scheduler or plugin service participates in opening the window.
  attachMainWindowServices(
    window,
    store,
    runtime,
    prepareCodexRuntimeHomeForLaunch,
    (target) => claudeRuntimeAuth.prepareForClaudeLaunch(target),
    {
      prepareCodexSessionResume: prepareCodexSessionResumeForLaunch,
      awaitLocalPtyStartup: () => state.localPtyStartupReady,
      awaitLocalPtyProviderStartup: () => state.localPtyProviderStartupReady,
      onBeforeRendererReload: ({ ignoreCache, webContentsId }) => {
        if (window.webContents.id === webContentsId) {
          deps.markExpectedRendererReload(webContentsId)
        }
        deps.recordRendererReload(ignoreCache)
      },
      // Recovery did-finish-load must skip orphan sweeping to preserve live PTYs (#5787).
      isRecoveryReloadInFlight,
      onCodexHomePtySpawned: handleCodexHomePtySpawned,
      onPtyExit: handlePtyExit,
      onBeforeUpdateQuit: () => preserveStateBeforeUpdateRestart({ codexRuntimeHome, store }),
      onBeforeUpdateQuitFailure: 'abort',
      updateInstallMode: resolveUpdateInstallMode(state.isServeMode)
    }
  )
  // RA: no permission-log helper or quota probes on startup, focus, show or restore.
  if (!backgroundJobsDisabled()) {
    initTccPromptNotice(window, { deferWatchUntilReadyToShow: true })
  }
}
