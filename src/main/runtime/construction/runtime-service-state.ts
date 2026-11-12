import { CrewChanges } from '../orchestration/crew/crew-changes'
import type { RuntimeTerminalSummary } from '../../../shared/runtime-terminal-contracts'
import { OrchestrationStructuredMailboxPointerDelivery } from '../orchestration/mailbox/structured-pointer/structured-mailbox-pointer-delivery'

import { createStructuredMailboxPointerHost } from '../orchestration/mailbox/structured-pointer/structured-mailbox-pointer-host'
import { localOrchestrationCliCommand } from '../orchestration/workers/launch/orchestration-cli-command'
import { RuntimeOrchestrationSenderNames } from '../orchestration/mailbox/senders/runtime-orchestration-sender-names'
import { isStructuredWorkerHandle } from '../../../shared/orchestration/workers/structured-worker-handle'
import { ORCA_SESSION_ADDRESS_PREFIX } from '../../../shared/orca-session-address-prefix'
import { resolveStructuredWorkerAuthority } from '../orchestration/terminal-authority/structured-sessions/structured-worker-authority'
import { OrcaRuntimeWithAgentOrchestrationDependencies } from '../orchestration/crew/runtime-agent-orchestration-dependencies'
import { RuntimeTerminalAgentPresence } from '../terminal/query/runtime-terminal-agent-presence'
import type { RuntimeNotifier } from '../client/events/runtime-notifier-contract'
import { RuntimeClientEventBus } from '../client/events/runtime-client-event-bus'
import { RuntimeNativeChatDraftResolutions } from '../agent-session/launch/runtime-native-chat-draft-resolutions'
import { RuntimeWorktreeLifecycleEvents } from '../workspaces/lifecycle/runtime-worktree-lifecycle-events'
import type { RuntimeWorktreeLifecycleEvent } from '../workspaces/lifecycle/worktree-lifecycle-event'
import type * as WorktreeScan from '../workspaces/catalog/runtime-worktree-scan-state'
import type { AgentBrowserBridge } from '../../browser/agent-browser/agent-browser-bridge'
import type { BrowserBackend } from '../../browser/browser-backend'
import type { EmulatorBridge } from '../../emulator/emulator-bridge'
import { RuntimeResolvedWorktreeCache } from '../workspaces/catalog/runtime-resolved-worktree-cache'
import { RuntimeWorktreeLineageController } from '../workspaces/lineage/runtime-worktree-lineage-controller'
import { createRuntimeAgentProjections } from './runtime-agent-projections'
import type { RuntimeLeafRecord } from '../terminal/records/runtime-terminal-state-records'
import {
  configureAgentLaunchParentPersistence,
  getAgentLaunchParents,
  getAgentOrchestratorContexts
} from '../runtime-agent-launch-parents'
import {
  RuntimeAgentOrchestrationProjection,
  type RuntimeAgentOrchestrationDependencies
} from '../runtime-agent-orchestration-projection'
import { RuntimeTerminalList, sleepingTerminalLeaf } from '../terminal/query/runtime-terminal-list'
import { RuntimeManagedWorktreeQueries } from '../workspaces/catalog/runtime-managed-worktree-queries'
import { RuntimePtyForegroundAgent } from '../terminal/lifecycle/runtime-pty-foreground-agent'
import { OpenCodeRunLifetimeStatus } from '../terminal/output/opencode-run-lifetime-status'
import { readLocalPtyForegroundCommandLine } from '../terminal/lifecycle/local-pty-foreground-command-line'
import { isAgentStatusHooksEnabledForAgent } from '../../../shared/agent-hook-listener/configuration/agent-status-hooks-setting'
import { RuntimeTerminalAgentStatusQuery } from '../terminal/query/runtime-terminal-agent-status-query'
import type { OrchestrationDb } from '../orchestration/db/orchestration-db'
import { OrchestrationMailboxOwner } from '../orchestration/mailbox/routing/mailbox-owner'
import { OrchestrationMailboxDeliveryTarget } from '../orchestration/mailbox/routing/mailbox-delivery-target'
import { OrchestrationMailboxPointerDelivery } from '../orchestration/mailbox/terminal-pointer/mailbox-pointer-delivery'
import { OrchestrationMailboxNotificationCoordinator } from '../orchestration/mailbox/notifications/mailbox-notification-coordinator'
import {
  RuntimeMessageWaiters,
  type RuntimeMessageWaiter
} from '../orchestration/mailbox/runtime-message-waiters'
import type { WorkerTurnStopReportDeps } from '../orchestration/workers/turn-stops/worker-turn-stop-report'
import type { RuntimeSkillCommands } from '../integrations/skill/runtime-skill-command-surface'
import { RuntimeTerminalStreamConsumers } from '../terminal/output/runtime-terminal-stream-consumers'
import type { RecentPtyOutputBuffer } from '../terminal/output/recent-pty-output-buffer'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../../shared/layout-owner-switch'
import { mainListsEveryPane } from '../terminal/surface/main-terminal-surfaces'
import { TUI_IDLE_QUIESCENCE_MS } from '../terminal/wait/terminal-idle-policy'
import { readScreenClearingBlockedTail } from '../terminal/wait/blocked-tail-screen-clear'
import { structuredMailboxCustody } from '../orchestration/mailbox/routing/structured-session-mail-target'

export abstract class OrcaRuntimeWithStopRequestedPtyIds extends OrcaRuntimeWithAgentOrchestrationDependencies {
  protected readonly stopRequestedPtyIds = new Set<string>()

  protected readonly ptyExitListenersByPtyId = new Map<string, Set<() => void>>()

  protected readonly terminalAgentPresence = new RuntimeTerminalAgentPresence({
    isLiveStructuredAgent: (handle) =>
      Boolean(resolveStructuredWorkerAuthority(handle, this._orchestrationDb)),
    getLivePty: (handle) => this.getLivePtyForHandle(handle)?.pty ?? null,
    getLiveLeaf: (handle) => this.getLiveLeafForHandle(handle).leaf,
    getPrimaryLeaf: (ptyId) => this.getLeavesForPty(ptyId)[0] ?? null,
    getTrackedPty: (ptyId) => this.ptysById.get(ptyId) ?? null,
    getTabTitle: (tabId) => this.tabs.get(tabId)?.title?.trim() || null,
    getForegroundProcess: (ptyId) => this.ptyController?.getForegroundProcess(ptyId) ?? null,
    confirmForegroundProcess: (ptyId) =>
      this.ptyController?.confirmForegroundProcess?.(ptyId) ?? null,
    getTitleDisplayClear: (ptyId) => this.getPtyTitleDisplayClear(ptyId)
  })

  protected notifier: RuntimeNotifier | null = null

  protected readonly clientEvents = new RuntimeClientEventBus({
    makeTitleGateKey: (rawTitle, normalizedTitle) =>
      this.makeDecorativeTitleGateKey(rawTitle, normalizedTitle),
    onConsumerAvailabilityChanged: () => this.refreshTerminalSideEffectConsumerAvailability()
  })

  protected readonly nativeChatDraftResolutions = new RuntimeNativeChatDraftResolutions({
    resolveOwner: (handle) => this.resolveNativeChatLaunchDraftOwner(handle),
    listMobileSnapshots: () => this.mobileSessionTabsByWorktree,
    setMobileSnapshot: (worktreeId, snapshot) =>
      this.storeMobileSessionSnapshot(worktreeId, snapshot),
    scheduleMobileSnapshot: (worktreeId) => this.scheduleMobileSessionTabsChanged(worktreeId),
    notifyResolved: (tabId, resolution, event) => {
      this.notifier?.nativeChatLaunchDraftResolved?.(tabId, resolution)
      this.emitClientEvent(event)
    }
  })

  protected readonly worktreeLifecycleEvents =
    new RuntimeWorktreeLifecycleEvents<RuntimeWorktreeLifecycleEvent>()

  protected agentBrowserBridge: AgentBrowserBridge | null = null

  protected offscreenBrowserBackend: BrowserBackend | null = null

  protected emulatorBridge: EmulatorBridge | null = null

  protected readonly resolvedWorktrees = new RuntimeResolvedWorktreeCache()

  protected worktreeScanGenerations = new Map<string, number>()

  protected worktreeScanCache = new Map<string, WorktreeScan.RuntimeWorktreeScanCache>()

  protected worktreeScanInFlight = new Map<string, WorktreeScan.RuntimeWorktreeScanInFlight>()

  /** Bound abandoned Git-admin filesystem probes to one per repo. */
  protected worktreeAdminFingerprintProbes = new Set<string>()

  protected readonly worktreeLineage = new RuntimeWorktreeLineageController({
    getStore: () => this.store,
    getDb: () => this.getOrchestrationDbIfAvailable(),
    resolveWorkspace: (selector, options) => this.resolveWorkspaceCandidate(selector, options),
    showTerminal: (handle) => this.showTerminal(handle)
  })

  protected override agentOrchestrationDependencies(
    bound?: Partial<RuntimeAgentOrchestrationDependencies>
  ) {
    // RA: existing host session partitions own CLI launch ancestry.
    configureAgentLaunchParentPersistence(this, {
      getStore: () => {
        const store = this.store
        return store?.getWorkspaceSession
          ? {
              getWorkspaceSession: store.getWorkspaceSession.bind(store),
              setWorkspaceSession: store.setWorkspaceSession?.bind(store),
              getWorkspaceSessionHostIds: store.getWorkspaceSessionHostIds?.bind(store)
            }
          : null
      },
      getPaneKey: (handle) => this.getTerminalPaneKey(handle),
      getHandle: (paneKey) => this.getTerminalHandleForPaneKey(paneKey)
    })
    return {
      ...super.agentOrchestrationDependencies(bound),
      getLaunchParents: () => getAgentLaunchParents(this),
      getOrchestratorContexts: () => getAgentOrchestratorContexts(this)
    }
  }

  protected readonly agentProjections = createRuntimeAgentProjections(this, {
    ...this.agentOrchestrationDependencies(),
    hasPublishedScope: (id) => this.mobileSessionTabsByWorktree.has(id),
    ...this.terminalHandleAccess()
  })

  protected readonly agentOrchestrationProjection = new RuntimeAgentOrchestrationProjection(
    this.agentOrchestrationDependencies()
  )

  protected readonly terminalList = new RuntimeTerminalList({
    // RA: include sleeping tabs even when their saved panes have never mounted in this window.
    getSleepingLeaves: () =>
      [...this.mobileSessionTabsByWorktree.values()].flatMap((snapshot) =>
        snapshot.tabs.flatMap((tab) => {
          if (tab.type !== 'terminal') {
            return []
          }
          const leaf = this.getSavedSleepingTerminalLeaf(
            snapshot.worktree,
            tab.parentTabId,
            tab.leafId
          )
          return leaf ? [leaf] : []
        })
      ),
    // RA: tab age and OSC-only activity for the human CLI, with no hooks or title inference.
    displayDetails: (terminal) => {
      const session = this.getWorkspaceSessionForWorktree(terminal.worktreeId)
      const tab = session?.tabsByWorktree[terminal.worktreeId]?.find(
        (item) => item.id === terminal.tabId
      )
      const record =
        session?.sleepingAgentSessionsByPaneKey?.[`${terminal.tabId}:${terminal.leafId}`]
      const sleeping = record && !terminal.connected ? record : null // RA: session records are already typed
      const activity =
        terminal.connected && terminal.ptyId
          ? this.ptysById.get(terminal.ptyId)?.lastAgentStatus
          : null
      const savedSleeper = !terminal.connected
        ? this.getSavedSleepingTerminalLeaf(terminal.worktreeId, terminal.tabId, terminal.leafId)
        : null
      const state: RuntimeTerminalSummary['state'] =
        sleeping || savedSleeper
          ? 'sleeping'
          : activity === 'working'
            ? 'working'
            : activity === 'permission'
              ? 'waiting'
              : activity === 'idle'
                ? 'idle'
                : undefined
      return {
        ...(tab ? { createdAt: tab.createdAt } : {}),
        ...(state ? { state } : {}),
        ...(sleeping ? { agentIdentity: sleeping.agent } : {})
      }
    },
    getGraphEpoch: () => (this.graphStatus === 'ready' ? this.rendererGraphEpoch : null),
    assertGraphEpoch: (epoch) => this.assertStableReadyGraph(epoch),
    getExplicitWorktreeId: (selector) => this.getExplicitSessionWorktreeIdSelector(selector),
    getResolvedCache: () => this.resolvedWorktrees.peek(),
    buildWorktreeFromId: (worktreeId) => this.buildResolvedWorktreeFromId(worktreeId),
    resolveWorktree: (selector) => this.resolveWorkspaceSelector(selector),
    listKnownWorktrees: (worktreeId, target) =>
      this.listKnownResolvedWorktreesForExplicitTarget(worktreeId, target),
    getWorktreeMap: () => this.getResolvedWorktreeMap(),
    refreshPtys: (worktrees, targetId) =>
      this.refreshPtyWorktreeRecordsWithControllerInventory(worktrees, targetId),
    getPtys: () => this.ptysById.values(),
    getLeaves: () => this.leaves.values(),
    buildLeafSummary: (leaf, worktrees, livePtyIds) =>
      this.buildTerminalSummary(leaf, worktrees, livePtyIds),
    buildPtySummary: (pty, worktrees) => this.buildPtyTerminalSummary(pty, worktrees),
    getSnapshots: () => this.mobileSessionTabsByWorktree,
    getTabTitle: (tabId) => this.tabs.get(tabId)?.title ?? null,
    getTopologyRevision: (worktreeId) => this.getTerminalTopologyRevision(worktreeId),
    buildHostScope: (targetWorktreeId, terminals, worktrees, queriedHostIds) =>
      this.buildTerminalListHostScope(targetWorktreeId, terminals, worktrees, queriedHostIds),
    ...(ORCA_LAYOUT_OWNER_IS_MAIN ? { listsEveryPane: (id) => mainListsEveryPane(this, id) } : {})
  })

  // RA: validate against current saved state on each read so closing/waking a tab retires this view.
  protected getSavedSleepingTerminalLeaf(
    worktreeId: string,
    tabId: string,
    leafId: string
  ): RuntimeLeafRecord | null {
    const session = this.getWorkspaceSessionForWorktree(worktreeId)
    const tab = session?.tabsByWorktree[worktreeId]?.find((item) => item.id === tabId)
    const saved = this.mobileSessionTabsByWorktree
      .get(worktreeId)
      ?.tabs.find(
        (item) => item.type === 'terminal' && item.parentTabId === tabId && item.leafId === leafId
      )
    if (!tab || !saved || saved.type !== 'terminal') {
      return null
    }
    if (saved.ptyId && this.ptysById.get(saved.ptyId)?.connected) {
      return null
    }
    const record = session?.sleepingAgentSessionsByPaneKey?.[`${tabId}:${leafId}`]
    const sleeping =
      !!record ||
      [...this.terminalSleepStateByHostWorktree.values()].some(
        (state) => state.worktreeId === worktreeId && state.phase === 'sleeping'
      )
    return sleeping
      ? sleepingTerminalLeaf({ worktreeId, tabId, leafId, title: tab.customTitle || saved.title })
      : null
  }

  protected readonly managedWorktreeQueries = new RuntimeManagedWorktreeQueries({
    getStore: () => this.store,
    listResolved: () => this.listResolvedWorktrees(),
    resolveRepo: (selector) => this.resolveRepoSelector(selector),
    selectRepos: (selector) => this.selectReposBySelector(selector),
    scanRepo: (repo) => this.listRepoWorktreesForListing(repo),
    listKnownHostIds: () => this.listKnownExecutionHostIds()
  })

  protected readonly ptyForegroundAgent = new RuntimePtyForegroundAgent({
    getController: () => this.ptyController,
    getPty: (ptyId) => this.ptysById.get(ptyId) ?? null,
    touchSnapshot: (ptyId) => this.touchMobileSessionSnapshotsForPty(ptyId),
    finishDelayedSnapshot: (ptyId, changed) => {
      if (this.mobileSessionTabListeners.size > 0) {
        this.mobileSessionTabsAgentStatusHeartbeat.observeSemanticTitle(ptyId)
      }
      if (!changed) {
        this.touchMobileSessionSnapshotsForPty(ptyId)
      }
    }
  })

  protected readonly openCodeRunLifetime = new OpenCodeRunLifetimeStatus({
    isObservablePty: (ptyId) => {
      const pty = this.ptysById.get(ptyId)
      // SSH/WSL foregrounds belong to the host/guest, not this process.
      return !!pty && !pty.connectionId && !pty.wslDistro && !this.wslDistroByPtyId.has(ptyId)
    },
    isStatusEnabled: (agent) =>
      isAgentStatusHooksEnabledForAgent(this.store?.getSettings?.(), agent),
    readForegroundProcessName: async (ptyId) => {
      const read = await this.ptyForegroundAgent.read(ptyId)
      return read?.available ? read.process : null
    },
    readForegroundCommandLine: (ptyId, foregroundProcess) =>
      readLocalPtyForegroundCommandLine(ptyId, foregroundProcess),
    // Renderer command-finished can drop unchanged status rows; publish Done after that fact.
    publish: (ptyId, payload, yieldsToHookSince) =>
      this.runAfterPendingTerminalSideEffectFacts(ptyId, () =>
        this.emitTerminalAgentStatusEvents(
          ptyId,
          { payloads: [payload] },
          { origin: 'process', yieldsToHookSince }
        )
      ),
    now: () => Date.now()
  })

  protected readonly terminalAgentStatus = new RuntimeTerminalAgentStatusQuery({
    getController: () => this.ptyController,
    getLivePty: (handle) => this.getLivePtyForHandle(handle),
    getLiveLeaf: (handle) => this.getLiveLeafForHandle(handle),
    getPrimaryLeaf: (ptyId) => this.getPrimaryLeafForPty(ptyId),
    getTabTitle: (tabId) => this.tabs.get(tabId)?.title ?? null,
    getExplicitStatus: (handle, ptyId) => this.getFreshExplicitAgentStatusForHandle(handle, ptyId),
    getLifecycleStatus: (ptyId) => this.agentPromptLifecycleByPtyId.get(ptyId),
    isRunning: (handle) => this.isTerminalRunningAgent(handle),
    getTitleDisplayClear: (ptyId) => this.getPtyTitleDisplayClear(ptyId),
    flushPendingBlockedStamp: (ptyId) => this.flushPendingWaitBlockedCheck(ptyId),
    readScreenClearingBlockedTail: (ptyId, lastOutputAt) =>
      readScreenClearingBlockedTail({
        lastOutputAt,
        quiescenceMs: TUI_IDLE_QUIESCENCE_MS,
        agent: () => this.getPaneAgentForTuiIdle(ptyId),
        readScreen: () => this.readCaughtUpRuledScreen(ptyId),
        clearStamp: () => this.clearWaitBlockedStamp(ptyId)
      })
  })

  readonly crewChanges = new CrewChanges()
  protected _orchestrationDb: OrchestrationDb | null = null

  protected readonly orchestrationMailboxOwner = new OrchestrationMailboxOwner({
    getDb: () => this._orchestrationDb,
    getTerminal: (ptyId) => this.getOrchestrationMailboxTerminal(ptyId),
    getTerminalProcessIncarnation: (handle) => this.getTerminalProcessIncarnation(handle),
    onRoutedMessageTypes: (mailboxHandle, types) =>
      this.messageWaiters.notifyRouted(mailboxHandle, types),
    onForeignMailboxRouted: (mailboxHandle, messageType) =>
      this.notifyMessageArrived(mailboxHandle, messageType)
  })

  protected readonly orchestrationMailboxDeliveryTarget = new OrchestrationMailboxDeliveryTarget({
    getDb: () => this._orchestrationDb,
    getMailboxTerminalForPaneKey: (paneKey) => this.getMailboxTerminalForPaneKey(paneKey),
    getTerminalForHandle: (handle) => this.getOrchestrationMailboxTerminalForHandle(handle),
    hasTerminalHandle: (handle) => this.hasMailboxTerminalHandle(handle),
    isStructuredSessionOwner: (handle) =>
      isStructuredWorkerHandle(handle) || handle.startsWith(ORCA_SESSION_ADDRESS_PREFIX),
    canProbePtyLiveness: () => Boolean(this.ptyController?.probePtyLiveness),
    controllerKnowsPtyIsLive: (ptyId) => this.controllerKnowsPtyIsLive(ptyId),
    isLeafPtyProvenAbsent: (ptyId) => this.isLeafPtyProvenAbsent(ptyId)
  })

  protected readonly orchestrationMailboxPointerDelivery = new OrchestrationMailboxPointerDelivery({
    mailboxOwner: this.orchestrationMailboxOwner,
    deliveryTarget: this.orchestrationMailboxDeliveryTarget,
    getDb: () => this._orchestrationDb,
    getTerminal: (ptyId) => this.getOrchestrationMailboxTerminal(ptyId),
    isAgentSettledForDelivery: (ptyId) => this.checkDeliverySettledAndArmRecheck(ptyId),
    isPtyAwaitingUserInput: (ptyId) => this.isPtyAwaitingUserInput(ptyId),
    getMessageWaiters: (mailboxHandle) => this.messageWaiters.get(mailboxHandle),
    getCliCommand: (terminalHandle) => this.getTerminalOrchestrationCliCommand(terminalHandle),
    resolveSubmitTarget: (ptyId) => this.resolveOrchestrationPointerSubmitTarget(ptyId),
    isLeafPtyProvenAbsent: (ptyId) => this.isLeafPtyProvenAbsent(ptyId),
    redriveMailbox: (mailboxHandle, reservedTypes) =>
      this.deliverPendingMessagesForHandle(mailboxHandle, reservedTypes),
    writePty: (ptyId, data) => this.writeOrchestrationPointerPty(ptyId, data)
  })

  protected readonly orchestrationStructuredMailboxPointerDelivery =
    new OrchestrationStructuredMailboxPointerDelivery<RuntimeMessageWaiter>({
      getDb: () => this._orchestrationDb,
      getMessageWaiters: (mailboxHandle) => this.messageWaiters.get(mailboxHandle),
      resolveStructuredTarget: (handle) => this.resolveStructuredMailboxTarget(handle),
      redeliver: (handle) => this.deliverPendingMessagesForHandle(handle),
      getCliCommand: localOrchestrationCliCommand,
      senderSnapshotReader: () => this.orchestrationSenderNames.snapshotReader(),
      senderSnapshot: (party, reportedDispatchId) =>
        this.orchestrationSenderNames.snapshotOf(party, reportedDispatchId),
      host: createStructuredMailboxPointerHost()
    })

  readonly orchestrationSenderNames = new RuntimeOrchestrationSenderNames({
    getHostScope: (id) =>
      JSON.stringify(this.getOrchestrationDispatchAuthority(id)?.hostScope || undefined) ?? null,
    getProcessIncarnation: (handle) => this.getTerminalProcessIncarnation(handle),
    getDb: () => this._orchestrationDb,
    getHandleRecord: (handle) => this.handles.get(handle),
    getPtyAgents: (ptyId) => this.ptysById.get(ptyId),
    getTerminalPaneKey: (handle) => this.getTerminalPaneKey(handle),
    getWorkspaceSession: (worktreeId) => this.getWorkspaceSessionForWorktree(worktreeId),
    getGeneratedTitlesEnabled: () => this.store?.getSettings?.()?.tabAutoGenerateTitle === true,
    getAgentStatusSnapshot: () => this.getAgentStatusSnapshotFn?.() ?? [],
    getAgentStatusSnapshotForPane: (paneKey) => this.getAgentStatusSnapshotForPaneFn?.(paneKey),
    getTrackedTitle: (ptyId) => this.getTrackedDisplayTitleForPty(ptyId)
  })

  protected readonly orchestrationMailboxNotifications =
    new OrchestrationMailboxNotificationCoordinator<RuntimeMessageWaiter>({
      mailboxOwner: this.orchestrationMailboxOwner,
      pointerDelivery: this.orchestrationMailboxPointerDelivery,
      structuredPointerDelivery: this.orchestrationStructuredMailboxPointerDelivery,
      getDb: () => this._orchestrationDb,
      getTerminalForHandle: (handle) => this.getOrchestrationMailboxTerminalForHandle(handle),
      getPaneKeyForHandle: (handle) => {
        const record = this.handles.get(handle)
        return record ? `${record.tabId}:${record.leafId}` : undefined
      },
      getMessageWaiters: (mailboxHandle) => this.messageWaiters.get(mailboxHandle),
      hasTerminalHandle: (handle) => this.hasMailboxTerminalHandle(handle),
      deliverForHandle: (handle, reservedTypes) =>
        this.deliverPendingMessagesForHandle(handle, reservedTypes),
      notifyMessageArrived: (handle, messageType) => this.notifyMessageArrived(handle, messageType),
      resolveMessageWaiters: (waiters) => this.messageWaiters.resolveNotified(waiters)
    })

  protected readonly messageWaiters = new RuntimeMessageWaiters()

  protected readonly workerTurnStopReportDeps: WorkerTurnStopReportDeps = {
    getDb: () => this._orchestrationDb,
    isWaitingForMail: (mailbox) => (this.messageWaiters.get(mailbox)?.size ?? 0) > 0,
    notify: (handle, messageType) => this.notifyMessageArrived(handle, messageType),
    isChatMailbox: (mailbox) =>
      typeof structuredMailboxCustody(mailbox, this._orchestrationDb) === 'object'
  }

  protected readonly skillCommands!: RuntimeSkillCommands

  protected readonly terminalStreamConsumers = new RuntimeTerminalStreamConsumers()

  // Replay bounded startup bytes when draft paste subscribes after the ready marker.
  protected recentPtyOutputById = new Map<string, RecentPtyOutputBuffer>()

  // A fresh launch's pending composer watch; submits await it, and it is dropped once settled.
  protected launchComposerReadyByPtyId = new Map<string, Promise<boolean>>()

  protected setupCompletionTokenByPtyId = new Map<string, string>()
}
