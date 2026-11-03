import { app, nativeTheme } from 'electron'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { StarNagService } from '../star-nag/service'
import { AgentBrowserBridge } from '../browser/agent-browser/agent-browser-bridge'
import { EmulatorBridge } from '../emulator/emulator-bridge'
import { RpcDispatcher } from '../runtime/rpc/dispatcher'
import { browserManager } from '../browser/browser-manager'
import { configureBrowserClientPageAutomationRuntime } from '../browser/browser-client-page-automation-runtime'
import { BrowserExpectedUrlMismatch } from '../../shared/browser-expected-url'
import { BrowserClientPageCommandError } from '../browser/browser-client-page-command-failure'
import { startPreGoneCrashSampling } from '../crash-reporting/process-gone-diagnostics'
import { recordProcessGoneCrash } from './main-window-lifecycle-flags'
import { handleGpuChildCrash } from './gpu-lifecycle'
import { isGpuFallbackCrashCandidate } from '../crash-reporting/gpu-crash-fallback-decision'
import { mainProcessState as state } from './main-process-state'
import { initializeMainProcessObservers } from './main-process-observers'
import { installFirstWorkRenameHookSubscription } from './branch-rename-hook'
import { initializeMainProcessAccountServices } from './main-process-account-services'
import {
  initializeMainProcessRuntime,
  configureRuntimeServices
} from './main-process-runtime-service'
import { initializeMainProcessAutomations } from './main-process-automations'
import { initializeMainProcessPlugins } from './main-process-plugins'
import {
  collectWorktreeTrashSweepRoots,
  sweepStaleWorktreeTrash
} from '../workspaces/removal/worktree-trash'
import { loadWorktreeRemovalRecordsForStore } from './worktree-removal-records-load'
import { runAfterFirstWindowShown } from './first-window-deferral'
import { logStartupMilestone } from './startup-diagnostics'
import { pruneDesktopOrcadArtifactCache } from '../orcad/orcad-artifact-cache-retention'
import { runGatedWslMoveDesktopRewritePass } from '../persistence/moving-wsl-projects/wsl-move-desktop-rewrite'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../shared/layout-owner-switch'
import { repairDuplicatePtyPanesOnStart } from '../runtime/moved-pane-owner-rekey'

// Headless serve has no first window; timer fallback must still sweep trash.
const WORKTREE_TRASH_SWEEP_FALLBACK_MS = 15_000

export async function initializeReadyRuntimeServices(): Promise<void> {
  const store = state.store
  if (!store) {
    throw new Error('Store must be initialized before ready services')
  }
  // Load interrupted deletion records before listings so first paint shows Deleting.
  await loadWorktreeRemovalRecordsForStore(store)
  initializeMainProcessObservers()
  initializeMainProcessAccountServices()
  const runtime = initializeMainProcessRuntime()
  initializeMainProcessAutomations()
  configureRuntimeServices(runtime)
  installFirstWorkRenameHookSubscription()
  await initializeMainProcessPlugins(runtime)
  state.starNag = new StarNagService(store, state.stats!)
  // RA: retain user-invoked star IPC without starting automatic nags.
  state.starNag.registerIpcHandlers()
  state.agentBrowserBridge = new AgentBrowserBridge(browserManager, {
    onTabsChanged: (worktreeId) => runtime.notifyMobileSessionTabsChanged(worktreeId)
  })
  runtime.setAgentBrowserBridge(state.agentBrowserBridge)
  // Reclaim browser daemons orphaned by prior crashes/SIGKILL.
  void state.agentBrowserBridge.sweepOrphanedSessions()
  const browserClientAutomationDispatcher = new RpcDispatcher({ runtime })
  configureBrowserClientPageAutomationRuntime({
    browserManager,
    getAgentBrowserBridge: () => state.agentBrowserBridge,
    executeRpc: async (method, params, signal) => {
      const response = await browserClientAutomationDispatcher.dispatch(
        { id: randomUUID(), authToken: 'local-browser-client-automation', method, params },
        // Why: forwarded automation comes from a remote agent's CLI; the cursor and tab badge key off it.
        { signal, caller: { kind: 'local-cli' } }
      )
      if (!response.ok) {
        const mismatch = BrowserExpectedUrlMismatch.safeParse(response.error.data)
        throw new BrowserClientPageCommandError(response.error.code, {
          expectedUrlMismatch: mismatch.success ? mismatch.data : undefined
        })
      }
      return response.result
    }
  })
  // Only Orca-managed emulator helpers belong to workspaces; external serve-sim stays independent. macOS capability gates live in CLI/runtime.
  state.emulatorBridge = new EmulatorBridge()
  runtime.setEmulatorBridge(state.emulatorBridge)
  // Finish recorded deletes and old trash left across crashes; defer disk sweeps so they do not compete with first paint/catalog hydration.
  runAfterFirstWindowShown(() => {
    void sweepStaleWorktreeTrash(
      collectWorktreeTrashSweepRoots(store.getRepos(), store.getSettings())
    ).catch((error) => {
      console.warn('[worktrees] Failed to sweep leftover worktree directories:', error)
    })
    runtime.finishInterruptedWorktreeRemovals()
  }, WORKTREE_TRASH_SWEEP_FALLBACK_MS)
  // RA: no agent plugin refresh or WSL usage reporter.
  runAfterFirstWindowShown(() => {
    void pruneDesktopOrcadArtifactCache(app.getPath('userData')).catch((error) => {
      console.warn('[orcad-artifacts] Failed to bound the slot cache:', error)
    })
  }, WORKTREE_TRASH_SWEEP_FALLBACK_MS)
  // The startup pass ran before browser sessions and any window existed, so `browser-cookies` paused.
  runAfterFirstWindowShown(() => {
    void runGatedWslMoveDesktopRewritePass({ userDataPath: app.getPath('userData') })
  }, WORKTREE_TRASH_SWEEP_FALLBACK_MS)
  nativeTheme.themeSource = store.getSettings().theme ?? 'system'
  // RA: no startup managed-hook reconciliation or Codex hook probes.
  // Sample live processes: gone-time metrics omit dead children and already-released memory.
  startPreGoneCrashSampling()
  app.on('child-process-gone', (_event, details) => {
    recordProcessGoneCrash('child', details.type, details.reason, details.exitCode ?? null, {
      name: details.name,
      serviceName: details.serviceName,
      type: details.type
    })
    if (
      isGpuFallbackCrashCandidate({
        platform: process.platform,
        processType: details.type,
        reason: details.reason
      })
    ) {
      const crashedAt = performance.now()
      void state.gpuCrashDiagnostics?.record()
      void handleGpuChildCrash(details.reason, details.exitCode ?? null, crashedAt)
    }
  })
  // Await duplicate-pane repair behind queued writes; all later phases must read the repaired tree.
  if (ORCA_LAYOUT_OWNER_IS_MAIN) {
    await repairDuplicatePtyPanesOnStart(store, runtime)
  }
  logStartupMilestone('services-initialized')
}
