import type { OrcaRuntimeService } from '../../../../orca-runtime'
import { OrchestrationError } from '../../../../orchestration/orchestration-error'
import {
  getRemoteDispatch,
  getRemoteDispatchReport
} from '../../../../orchestration/db/remote-owned/remote-dispatch-records'

/** Observe durable Dispatch reports through the existing mailbox wake; never consume coordinator mail. */
export async function waitForWorkerResult(
  runtime: Pick<
    OrcaRuntimeService,
    'getOrchestrationDb' | 'waitForMessage' | 'ensureOrchestrationFederationRelay'
  >,
  dispatchId: string,
  timeoutMs: number,
  signal?: AbortSignal
) {
  const db = runtime.getOrchestrationDb()
  const dispatch = db.getDispatchContextById(dispatchId) ?? getRemoteDispatch(db, dispatchId)
  if (!dispatch) {
    throw new OrchestrationError(
      'dispatch_not_found',
      `Worker Dispatch ${dispatchId} was not found.`
    )
  }
  const runId = dispatch.run_id
  const taskId = dispatch.task_id
  const deadline = Date.now() + timeoutMs
  runtime.ensureOrchestrationFederationRelay(runId)
  for (;;) {
    const remote = getRemoteDispatch(db, dispatchId)
    if (!remote && !db.getDispatchContextById(dispatchId)) {
      throw new OrchestrationError(
        'dispatch_not_found',
        `Worker Dispatch ${dispatchId} was removed while waiting.`
      )
    }
    const worker = db.getWorkerDispatch(dispatchId)
    const state = remote?.worker_state ?? worker?.state
    const report = db
      .getAttemptObservationFacts(dispatchId)
      .filter((fact) => fact.facet === 'worker_report' && fact.payload.status === 'accepted')
      .sort((a, b) => b.sequence - a.sequence)[0]
    const accepted =
      report?.facet === 'worker_report' && report.payload.status === 'accepted'
        ? report.payload
        : undefined
    const remoteReport = remote ? getRemoteDispatchReport(db, dispatchId, runId) : undefined
    const result = accepted?.reportId
      ? db.getMessageById(accepted.reportId.replace(/^worker_report:/, ''))?.body
      : remoteReport?.body
    const outcome =
      accepted?.outcome ??
      remoteReport?.outcome ??
      (!remote && (state === 'succeeded' || state === 'failed') ? state : null)
    const settled = outcome !== null || state === 'stopped' || state === 'abandoned'
    const timedOut = !settled && Date.now() >= deadline
    const cancelled = signal?.aborted === true
    if (settled || timedOut || cancelled) {
      return {
        runId,
        taskId,
        dispatchId,
        state: outcome ?? state,
        outcome,
        result: result ?? null,
        timedOut,
        cancelled
      }
    }
    const changed = new AbortController()
    const unsubscribe = db.crewChanges.subscribe(() => changed.abort())
    try {
      const wake = await runtime.waitForMessage(`run:${runId}`, {
        timeoutMs: Math.max(1, deadline - Date.now()),
        signal: signal ? AbortSignal.any([signal, changed.signal]) : changed.signal
      })
      if (wake === 'cancelled' && !changed.signal.aborted) {
        return {
          runId,
          taskId,
          dispatchId,
          state,
          outcome: null,
          result: null,
          timedOut: false,
          cancelled: true
        }
      }
    } finally {
      unsubscribe()
    }
  }
}
