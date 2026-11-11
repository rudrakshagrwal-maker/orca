import {
  AGENT_PROMPT_EFFECT_TIMEOUT_MS,
  ORCHESTRATION_WORKER_START_CLIENT_GRACE_MS
} from '../../../../../../shared/orchestration-timing-budgets'
import type { OrcaRuntimeService } from '../../../../orca-runtime'
import type { OrchestrationDb } from '../../../../orchestration/db'
import type { RunRow, TaskRow } from '../../../../orchestration/types'
import type { WorkerStartModeReceipt } from '../../orchestration-worker-start-mode'
import { ORCA_DISPATCH_STATUS_PREAMBLE_PREFIX } from '../../../../../../shared/orca-dispatch-status-prompt'
import { createWorkerBriefWriteGuard } from '../../../../launched-agent-write-guard'
import { deliverWorkerDispatchPreamble } from './deliver-worker-dispatch-preamble'
import { reportedWorkerOutcome } from './worker-start-receipt'
import { chatAssigneeSessionId } from '../../../../orchestration/chat-assignee'
import type { OrchestrationWorkerLaunchReceipt } from './worker-launch-preferences'
import {
  describeUnobservedWorkerTurnStart,
  observeWorkerTurnStart,
  type WorkerTurnStartObservation
} from './worker-start-turn-observation'
import {
  monitorWorkerSetup,
  type createStructuredWorkerSessionForWorktree,
  type WorkerEffect,
  type WorkerSetupReceipt
} from './worker-topology'

/** RA: below this much client grace, a second Enter could not be observed in time. */
const RESUBMIT_MIN_GRACE_MS = 5_000

/** RA: the composer still holds this worker's brief: the text arrived, its Enter did not. */
export function composerHoldsWorkerBrief(draft: string | undefined, taskId: string): boolean {
  if (!draft) {
    return false
  }
  const flat = draft.replace(/\s+/g, ' ')
  return flat.includes(ORCA_DISPATCH_STATUS_PREAMBLE_PREFIX) || flat.includes(taskId)
}

/** RA: press Enter once more, only when the screen proves the brief sits unsent, so a task is never sent twice. */
async function resubmitHeldWorkerBrief(args: {
  runtime: OrcaRuntimeService
  terminalHandle: string
  taskId: string
  agent: string
  turnStart: WorkerTurnStartObservation
  graceLeft: () => number
}): Promise<WorkerTurnStartObservation> {
  const { runtime, terminalHandle, turnStart } = args
  if (args.graceLeft() < RESUBMIT_MIN_GRACE_MS) {
    return turnStart
  }
  const guard = createWorkerBriefWriteGuard(runtime, args.agent, true)
  try {
    const screen = await runtime.readTerminal(terminalHandle, { screen: true, limit: 50 })
    if (!composerHoldsWorkerBrief(screen.draft, args.taskId)) {
      return turnStart
    }
    await runtime.sendTerminal(
      terminalHandle,
      { enter: true },
      { inputKind: 'orchestration', ...(guard ? { beforeWrite: guard.beforeWrite } : {}) }
    )
  } catch {
    // An unreadable screen or a refused write leaves the start as unknown as it was.
    return turnStart
  } finally {
    guard?.dispose()
  }
  const again = await observeWorkerTurnStart({
    runtime,
    terminalHandle,
    prompt: turnStart.prompt,
    timeoutMs: args.graceLeft()
  })
  return again.verdict === 'unsupported' ? turnStart : again
}

/** Claim ready only for proven turn start or unsupported observation; supported-but-unobserved starts remain start_unknown. */
export async function deliverAndSettleWorkerStartReadiness(args: {
  runtime: OrcaRuntimeService
  db: OrchestrationDb
  run: RunRow
  task: TaskRow
  dispatchId: string
  dispatchDepth: number
  structuredSession: Awaited<ReturnType<typeof createStructuredWorkerSessionForWorktree>> | null
  terminalHandle: string
  coordinatorHandle: string
  devMode: boolean | undefined
  requestId: string
  agent: string | null
  /** The agent this start launched into `terminalHandle`; null when the caller supplied it. */
  launchedAgent: string | null
  setupReceipt: WorkerSetupReceipt
  launchReceipt: OrchestrationWorkerLaunchReceipt
  mode: WorkerStartModeReceipt
  /** The caller's timeout, as the receipt reports it. */
  timeoutMs: number
  /** When the caller's timeout runs out; a structured preamble waits on its agent until then. */
  readinessDeadline: number
  effects: WorkerEffect[]
  terminalRevealWarning: string | undefined
  /** Keeps the caller's failure receipt naming the stage that actually failed. */
  onStage: (stage: 'dispatch_input' | 'turn_observation') => void
}): Promise<unknown> {
  const { runtime, db, run, task, structuredSession, terminalHandle, effects } = args

  args.onStage('dispatch_input')
  const deliveryStartedAt = Date.now()
  const delivery = await deliverWorkerDispatchPreamble({
    runtime,
    db,
    structuredSession,
    terminalHandle,
    dispatchId: args.dispatchId,
    dispatchDepth: args.dispatchDepth,
    runId: run.id,
    taskId: task.id,
    taskSpec: task.spec,
    coordinatorHandle: args.coordinatorHandle,
    devMode: args.devMode,
    requestId: args.requestId,
    launchedAgent: args.launchedAgent,
    readinessTimeoutMs: Math.max(0, args.readinessDeadline - Date.now())
  })
  effects.push({
    kind: 'dispatch_input',
    role: 'agent',
    id: terminalHandle,
    state: 'accepted'
  })

  args.onStage('turn_observation')
  // Accepted writes need positive turn-start evidence when supported; structured sends prove acceptance or remain held.
  const promptDelivery = delivery.prompt
  const graceLeft = (): number =>
    Math.max(0, ORCHESTRATION_WORKER_START_CLIENT_GRACE_MS - (Date.now() - deliveryStartedAt))
  let turnStart: WorkerTurnStartObservation =
    delivery.structuredTurnStart ??
    (await observeWorkerTurnStart({
      runtime,
      terminalHandle,
      prompt: promptDelivery,
      // Why: a delivery that waited out a held Windows paste must still fit the client's grace.
      timeoutMs: Math.min(AGENT_PROMPT_EFFECT_TIMEOUT_MS, graceLeft())
    }))
  // RA: a swallowed Enter leaves the brief unsent in the composer (9 Nov, ctx_0f819f0cf30b).
  if (turnStart.verdict === 'unobserved' && !delivery.structuredTurnStart && args.launchedAgent) {
    turnStart = await resubmitHeldWorkerBrief({
      runtime,
      terminalHandle,
      taskId: task.id,
      agent: args.launchedAgent,
      turnStart,
      graceLeft
    })
  }
  const deliveredPrompt = turnStart.prompt ?? promptDelivery
  monitorWorkerSetup({
    runtime,
    db,
    runId: run.id,
    dispatchId: args.dispatchId,
    setupReceipt: args.setupReceipt,
    effects
  })
  // A worker report can settle the dispatch while turn observation is outstanding.
  const currentWorker = db.getWorkerDispatch(args.dispatchId)
  const alreadySettled = currentWorker && currentWorker.state !== 'starting'
  // Only Orca's own worker chat queues behind its own turn, so its card is sure to run; a user's chat may drop it.
  const queuedOnOwnWorker =
    turnStart.queued === true &&
    db.getWorkerTerminalResourceByOwner(args.dispatchId)?.ownership_state === 'owned'
  if (turnStart.verdict === 'unobserved' && !queuedOnOwnWorker && !alreadySettled) {
    // Keep authority and terminal for recovery reports, but never claim ready for an unobserved turn.
    effects.push({
      kind: 'dispatch_input',
      role: 'agent',
      id: terminalHandle,
      state: 'turn_unobserved'
    })
    const reason = turnStart.reason ?? describeUnobservedWorkerTurnStart(args.agent)
    const worker = db.markWorkerStartUnknown(
      args.dispatchId,
      'turn_start_unobserved',
      reason,
      effects
    )
    return {
      runId: run.id,
      taskId: task.id,
      dispatchId: args.dispatchId,
      state: 'outcome_unknown',
      stage: worker.stage,
      turnStart: turnStart.verdict,
      lastError: reason,
      setup: args.setupReceipt,
      launch: args.launchReceipt,
      mode: args.mode,
      timeoutMs: args.timeoutMs,
      effects,
      ...(deliveredPrompt ? { prompt: deliveredPrompt } : {}),
      residualResources: JSON.parse(worker.residual_resources) as unknown[],
      nextCommands: [
        `orca orchestration worker-show --dispatch ${args.dispatchId} --json`,
        // A structured worker or a chat has no screen to read.
        ...(structuredSession || chatAssigneeSessionId(terminalHandle)
          ? []
          : [`orca terminal read --terminal ${terminalHandle} --screen`]),
        `orca orchestration worker-abandon --dispatch ${args.dispatchId} --json`
      ],
      ...(args.terminalRevealWarning ? { warning: args.terminalRevealWarning } : {})
    }
  }
  const worker = alreadySettled
    ? currentWorker
    : db.markWorkerDispatchReady(args.dispatchId, effects)
  const reportedOutcome = reportedWorkerOutcome(worker)
  return {
    runId: run.id,
    taskId: task.id,
    dispatchId: args.dispatchId,
    state: reportedOutcome ? 'ready' : worker.state,
    stage: worker.stage,
    ...(reportedOutcome ? { workerOutcome: reportedOutcome } : {}),
    turnStart: queuedOnOwnWorker ? 'queued' : turnStart.verdict,
    setup: args.setupReceipt,
    launch: args.launchReceipt,
    mode: args.mode,
    timeoutMs: args.timeoutMs,
    effects,
    ...(deliveredPrompt ? { prompt: deliveredPrompt } : {}),
    residualResources: [],
    ...(args.terminalRevealWarning ? { warning: args.terminalRevealWarning } : {})
  }
}
