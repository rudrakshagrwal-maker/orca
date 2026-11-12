import { backgroundJobsDisabled } from '../../shared/fork-background-policy'
import { app, nativeTheme } from 'electron'
import { performance } from 'node:perf_hooks'
import { StarNagService } from '../star-nag/service'
import { startPreGoneCrashSampling } from '../crash-reporting/process-exits/process-gone-diagnostics'
import { refuseRealtimeSchedulingUnderZeroRtTime } from './linux-realtime-scheduling-guard'
import { recordProcessGoneCrash } from './main-window-lifecycle-flags'
import { handleGpuChildCrash } from './gpu-lifecycle'
import { isGpuFallbackCrashCandidate } from '../crash-reporting/recovery/gpu-crash-fallback-decision'
import { mainProcessState as state } from './main-process-state'
import { initializeMainProcessObservers } from './main-process-observers'
import { installFirstWorkRenameHookSubscription } from './branch-rename-hook'
import { initializeMainProcessAccountServices } from './main-process-account-services'
import {
  initializeMainProcessRuntime,
  configureRuntimeServices
} from './main-process-runtime-service'
import {
  collectWorktreeTrashSweepRoots,
  sweepStaleWorktreeTrash
} from '../workspaces/removal/worktree-trash'
import { loadWorktreeRemovalRecordsForStore } from './worktree-removal-records-load'
import { runAfterFirstWindowShown } from './first-window-deferral'
import { logStartupMilestone } from './startup-diagnostics'
import { pruneDesktopOrcadArtifactCache } from '../orcad/orcad-artifact-cache-retention'
import { runGatedWslMoveDesktopRewritePass } from '../persistence/moving-wsl-projects/desktop-state/wsl-move-desktop-rewrite'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../shared/layout-owner-switch'
import { repairDuplicatePtyPanesOnStart } from '../runtime/terminal/identity/moved-pane-owner-rekey'

// Headless serve has no first window; timer fallback must still sweep trash.
const WORKTREE_TRASH_SWEEP_FALLBACK_MS = 15_000

export async function initializeReadyRuntimeServices(): Promise<void> {
  const store = state.store
  if (!store) {
    throw new Error('Store must be initialized before ready services')
  }
  // Renderers fork from zygotes that exist already, so this must land before the first window.
  await refuseRealtimeSchedulingUnderZeroRtTime()
  // Load interrupted deletion records before listings so first paint shows Deleting.
  await loadWorktreeRemovalRecordsForStore(store)
  initializeMainProcessObservers()
  initializeMainProcessAccountServices()
  const runtime = initializeMainProcessRuntime()
  // RA: skip both construction and module loading of the automation scheduler.
  if (!backgroundJobsDisabled()) {
    const { initializeMainProcessAutomations } = await import('./main-process-automations')
    initializeMainProcessAutomations()
  }
  configureRuntimeServices(runtime)
  installFirstWorkRenameHookSubscription()
  // RA: do not load marketplace and worker implementations into the terminal runtime.
  if (!backgroundJobsDisabled()) {
    const { initializeMainProcessPlugins } = await import('./main-process-plugins')
    await initializeMainProcessPlugins(runtime)
  }
  state.starNag = new StarNagService(store, state.stats!)
  // RA: retain user-invoked star IPC without starting automatic nags.
  state.starNag.registerIpcHandlers()
  // RA: browser proxies, emulator bridges and dispatchers stay outside terminal startup imports.
  if (!backgroundJobsDisabled()) {
    const { initializeMainProcessBrowserRuntime } = await import('./main-process-browser-runtime')
    initializeMainProcessBrowserRuntime(runtime)
  }
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
  // Load the dictation model after first paint; coming back to Orca re-warms one the idle timer unloaded.
  // RA: no speech import/model warmup on startup or focus.
  if (!backgroundJobsDisabled()) {
    const { startSpeechModelWarmup } = await import('../speech/speech-model-warmup')
    runAfterFirstWindowShown(() => {
      app.on('browser-window-focus', startSpeechModelWarmup(store))
    }, WORKTREE_TRASH_SWEEP_FALLBACK_MS)
  }
  // RA: never load automatic writers for another agent's settings.
  if (!backgroundJobsDisabled()) {
    const { startClaudeCodeThemeSync } =
      await import('../claude/theme-sync/claude-code-theme-sync-schedule')
    runAfterFirstWindowShown(() => {
      startClaudeCodeThemeSync({
        getSettings: () => store.getSettings(),
        onSettingsChanged: (listener) => store.onSettingsChanged(listener),
        systemPrefersDark: () => nativeTheme.shouldUseDarkColors,
        onSystemThemeChanged: (listener) => nativeTheme.on('updated', listener),
        onAppFocused: (listener) => app.on('browser-window-focus', listener),
        userDataPath: app.getPath('userData')
      })
    }, WORKTREE_TRASH_SWEEP_FALLBACK_MS)
  }
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
