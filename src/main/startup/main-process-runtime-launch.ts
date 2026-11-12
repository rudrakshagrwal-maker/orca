import { backgroundJobsDisabled } from '../../shared/fork-background-policy'
import { app, type BrowserWindow } from 'electron'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../shared/layout-owner-switch'
import { placeUnshownLiveTerminalsBestEffort } from '../runtime/terminal/adoption/unshown-live-terminal-placement'
import {
  getCanonicalUserDataPath,
  migrateMobilePairingDataToCanonicalUserDataPath
} from '../persistence/loading-store/user-data-path'
import { OrcaRuntimeRpcServer } from '../runtime/rpc/server/runtime-rpc'
import { resolveServePinnedBindHost } from './serve-pinned-bind-host'
import { isOrcadSidecarLaunch } from '../window/foreground-activation-policy'
import { getLocalPtyProvider } from '../ipc/pty/provider/registry'
import { registerHeadlessPtyRuntime } from '../ipc/pty/register-headless-runtime'
import { LocalPtyProvider } from '../providers/local-pty/local-pty-provider'
import { publishHeadlessRuntimeGraph } from '../runtime/session-graph/headless-runtime-graph'
import { getServeOptions, getBundledWebClientRoot, printServeReady } from './main-process-serve'
import {
  bindTerminalRuntimeStartupServices,
  handleCodexHomePtySpawned,
  handlePtyExit,
  startTerminalRuntimeStartupServices
} from './main-process-pty-startup'
import { prepareCodexRuntimeHomeForLaunch } from './codex-launch-preparation'
import { prepareCodexSessionResumeForLaunch } from './codex-session-resume-launch'
import { startWindowsDesktopBeforeShellPathReady } from './windows-desktop-shell-path-startup'
import { repairKnownPoisonedInstallDirBeforeWindow } from './windows-install-dir-acl-recovery'
import { installServeQuitHandling } from './serve-quit-handling'
import { registerHeadlessServeSshHandlers } from './headless-serve-ssh-registration'
import { settleServeDesktopActivation } from './serve-desktop-activation'
import {
  recordRuntimeRpcStartFailure,
  showRuntimeRpcStartupFailureDialog
} from '../runtime/rpc/server/runtime-rpc-startup-failure'
import { registerCliForHeadlessServe } from './serve-cli-registration'
import { startAppImageCopyPreExtraction } from '../cli/appimage/appimage-copy-pre-extraction'
import { scheduleAllPendingHistoryTreeRemovals } from '../pty/history/terminal-history-deletion'
import { mainProcessState as state } from './main-process-state'
import { logStartupMilestone } from './startup-diagnostics'
import { setupHeadlessServeAutoUpdater } from '../window/main-window-updater'
import { preserveStateBeforeUpdateRestart } from '../updater/update-restart-preservation'
import { resolveUpdateInstallMode } from '../updater/updater-service'
import { scheduleAgentLaunchRecordWarmup } from './agent-launch-record-warmup'

type RuntimeService = NonNullable<typeof state.runtime>

export type MainProcessRuntimeLaunchOptions = {
  openMainWindow: (options?: { revealOnDidFinishLoad?: boolean }) => BrowserWindow
  handleMacAppActivation: () => void
}

function settleDesktopActivation(): void {
  const gate = state.desktopActivationGate
  if (!gate) {
    return
  }
  settleServeDesktopActivation(gate, {
    hasPersistentPtyProvider: !(getLocalPtyProvider() instanceof LocalPtyProvider)
  })
}

/** Construct the runtime RPC server with serve-specific bind and port exposure settings. */
function installRuntimeRpc(
  runtime: RuntimeService,
  serveOptions: ReturnType<typeof getServeOptions> | null
): OrcaRuntimeRpcServer {
  // Migrate pairing credentials from late-resolved userData before switching to the canonical path.
  // RA: terminal RPC does not migrate or initialize phone pairing state.
  if (!backgroundJobsDisabled()) migrateMobilePairingDataToCanonicalUserDataPath(app.getPath('userData'))
  // Use OS-assigned ports for concurrent E2E Electron instances to avoid EADDRINUSE.
  const isE2E = Boolean(process.env.ORCA_E2E_USER_DATA_DIR)
  const requestedE2EWsPort = process.env.ORCA_E2E_RUNTIME_WS_PORT
  const e2eWsPort = requestedE2EWsPort === undefined ? 0 : Number(requestedE2EWsPort)
  if (isE2E && (!Number.isInteger(e2eWsPort) || e2eWsPort < 0 || e2eWsPort > 65_535)) {
    throw new Error(`Invalid ORCA_E2E_RUNTIME_WS_PORT value: ${requestedE2EWsPort}`)
  }
  // STA-1511: separate dev port from packaged Orca so pairing/repro URLs do not fall back unpredictably.
  const devWsPort = !app.isPackaged && !isE2E ? 6769 : undefined
  const pinnedBindHost = resolveServePinnedBindHost({
    orcadSidecar: isOrcadSidecarLaunch(),
    serveOptions
  })
  const runtimeRpc = new OrcaRuntimeRpcServer({
    runtime,
    // Pairing must use pre-setName canonical userData or restarts can lose devices.
    userDataPath: getCanonicalUserDataPath(),
    // RA: desktop CLI uses the named pipe/socket; no mobile WS/HTTP server at idle.
    enableWebSocket: !backgroundJobsDisabled() || serveOptions !== null,
    // STA-2370: desktop stays loopback until pairing; serve explicitly opts into remote access and E2E needs harness-wide bind.
    exposeNetworkByDefault: Boolean(serveOptions) || isE2E,
    ...(pinnedBindHost !== undefined ? { pinnedBindHost } : {}),
    ...(serveOptions
      ? {
          serveNetworkSources: {
            allowPublic: serveOptions.allowPublic,
            refusePublic: serveOptions.refusePublic,
            pairingAddress: serveOptions.pairingAddress
          }
        }
      : {}),
    ...(isE2E ? { wsPort: e2eWsPort } : {}),
    ...(devWsPort !== undefined ? { wsPort: devWsPort } : {}),
    ...(serveOptions?.wsPort !== undefined
      ? {
          wsPort: serveOptions.wsPort,
          // Explicit serve --port replaces stale fallback (#8535); defaults retain fallback-first pairing stability.
          preferPinnedWsPort: true,
          requirePinnedWsPort: true
        }
      : {}),
    webClientRoot: backgroundJobsDisabled() ? undefined : getBundledWebClientRoot()
  })
  state.runtimeRpc = runtimeRpc
  runtime.setAgentSenderPeerKey(() => runtimeRpc.getE2EEPublicKey())
  // RA: retain remote orchestration transport without mobile handler/relay imports.
  return runtimeRpc
}

async function launchServeMode(
  runtime: RuntimeService,
  runtimeRpc: OrcaRuntimeRpcServer,
  serveOptions: NonNullable<ReturnType<typeof getServeOptions>>
): Promise<void> {
  // Headless serve has no first paint to prioritize; apply persisted proxy before relay/CLI/RPC fetchers.
  await state.initialProxyApplicationReady
  // Give WSL registration brief migration time without letting slow repair hold all RPC readiness.
  logStartupMilestone('wsl-cli-barrier-start')
  await state.managedWslCliStartupBarrierReady
  logStartupMilestone('wsl-cli-barrier-resolved', {
    reconciliation: state.managedWslCliReconciliationStatus
  })
  // Headless PTYs must not use fallback before desktop activation swaps providers.
  await state.localPtyStartupReady
  await state.localPtyProviderStartupReady
  await registerHeadlessPtyRuntime(
    runtime,
    prepareCodexRuntimeHomeForLaunch,
    () => state.store!.getSettings(),
    (target) => state.claudeRuntimeAuth!.prepareForClaudeLaunch(target),
    state.store!,
    prepareCodexSessionResumeForLaunch,
    { onCodexHomePtySpawned: handleCodexHomePtySpawned, onPtyExit: handlePtyExit }
  )
  await runtime.refreshRestoredOrchestrationAuthority()
  await runtime.reconcileLegacyWorkerTerminals()
  runtime.startupWorkerAuthority.finish()
  // Main places unshown live terminals before any client attaches.
  if (ORCA_LAYOUT_OWNER_IS_MAIN) {
    await placeUnshownLiveTerminalsBestEffort(runtime)
  }
  // RA: terminal-only serve never imports or creates an offscreen browser window.
  publishHeadlessRuntimeGraph(runtime)
  // Register SSH before binding RPC so the first paired client sees targets.
  registerHeadlessServeSshHandlers(state.store!, runtime)
  await runtimeRpc.start().catch((error) => {
    console.error('[runtime] Failed to start headless RPC transport:', error)
    throw error
  })
  scheduleAgentLaunchRecordWarmup(null)
  // Headless phones still register/unregister tokens, though this host dispatches no push notifications.
  // RA: no cloud push service.
  settleDesktopActivation()
  installServeQuitHandling()
  await registerCliForHeadlessServe()
  // Headless automation cannot wait for a renderer that never opens.
  // RA: headless workers do not start the disabled automation scheduler either.
  if (!backgroundJobsDisabled()) state.automations?.start()
  // Arm history-removal GC without a window so interrupted serve deletions do not leak until desktop launch.
  void scheduleAllPendingHistoryTreeRemovals()
  await printServeReady(serveOptions)
  const store = state.store!
  setupHeadlessServeAutoUpdater(store, {
    onBeforeUpdateQuit: () =>
      preserveStateBeforeUpdateRestart({ codexRuntimeHome: state.codexRuntimeHome, store }),
    onBeforeUpdateQuitFailure: 'abort',
    updateInstallMode: resolveUpdateInstallMode(true)
  })
}

async function launchDesktopMode(
  runtimeRpc: OrcaRuntimeRpcServer,
  shellPathReady: Promise<void>,
  desktopWindow: BrowserWindow | null,
  openMainWindow: MainProcessRuntimeLaunchOptions['openMainWindow']
): Promise<void> {
  // Retain startup failure on incomplete runtime composition.
  if (!runtimeRpc) {
    throw new Error('runtime_rpc_unavailable')
  }
  // PTY spawn gates permit parallel window/RPC startup without racing daemon-provider adoption.
  const [win, runtimeRpcStartResult] = await Promise.all([
    Promise.resolve(desktopWindow ?? openMainWindow()),
    shellPathReady
      .then(() => runtimeRpc.start())
      .then(
        () => ({ ok: true as const }),
        (error: unknown) => {
          recordRuntimeRpcStartFailure(error)
          return { ok: false as const, error }
        }
      )
  ])
  scheduleAgentLaunchRecordWarmup(win)
  if (!runtimeRpcStartResult.ok) {
    // Await i18n only for the failure dialog; parallel launch must not show English fallback to non-English users.
    void state.mainProcessI18nReady.then(() =>
      showRuntimeRpcStartupFailureDialog(win, runtimeRpcStartResult.error)
    )
  }
  // Register before proxy await so concurrent token mints wait rather than fail provider_missing; installer requests are already guarded.
  // RA: no relay or connector cloud connection.
  // Create the window before awaiting proxy readiness; the request guard already fences fetches.
  await state.initialProxyApplicationReady
  // Apply persisted proxy before the push gateway's first request.
  // RA: no cloud push service.
  // RA: notification permission is requested only through explicit user actions.
}

export async function initializeMainProcessRuntimeLaunch(
  options: MainProcessRuntimeLaunchOptions
): Promise<void> {
  const runtime = state.runtime
  const shellPathHydration = state.windowsShellPathHydration
  if (!runtime || !shellPathHydration) {
    throw new Error('Runtime and shell-path services must be initialized before launch')
  }
  let serveOptions: ReturnType<typeof getServeOptions> | null = null
  try {
    serveOptions = state.isServeMode ? getServeOptions(process.argv) : null
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    app.exit(1)
    return
  }
  state.serveOptions = serveOptions
  // RA: no cloud session upload on shutdown.
  const runtimeRpc = installRuntimeRpc(runtime, serveOptions)
  // RA: no desktop cloud connector registration.
  const shellPathReady = shellPathHydration.whenReady()
  // Publish the same shell-PATH generation to renderer Git and terminal startup barriers.
  state.shellPathReady = shellPathReady
  // Repair known poisoned DACL before renderer initialization; the ordinary probe finishes too late to prevent its first crash.
  const aclGate = await repairKnownPoisonedInstallDirBeforeWindow({
    isServeMode: state.isServeMode || serveOptions !== null,
    userDataPath: app.getPath('userData'),
    appVersion: app.getVersion()
  })
  if (aclGate !== 'not-marked' && aclGate !== 'skipped') {
    logStartupMilestone('install-dir-acl-repair-blocking-done', { mode: aclGate })
  }
  let desktopWindow: BrowserWindow | null = null
  if (process.platform === 'win32' && app.isPackaged && !serveOptions) {
    const desktopStartup = startWindowsDesktopBeforeShellPathReady({
      bindServices: bindTerminalRuntimeStartupServices,
      openWindow: () => options.openMainWindow({ revealOnDidFinishLoad: true }),
      shellPathReady,
      startServices: startTerminalRuntimeStartupServices
    })
    desktopWindow = desktopStartup.window
  } else {
    // Start AppImage extraction before daemon host selection briefly awaits it; serve manages its own bounded extraction.
    if (!serveOptions) {
      void startAppImageCopyPreExtraction()
    }
    await shellPathReady
    bindTerminalRuntimeStartupServices(Promise.resolve(startTerminalRuntimeStartupServices()))
  }
  app.on('activate', options.handleMacAppActivation)
  if (serveOptions) {
    await launchServeMode(runtime, runtimeRpc, serveOptions)
    return
  }
  await launchDesktopMode(runtimeRpc, shellPathReady, desktopWindow, options.openMainWindow)
}
