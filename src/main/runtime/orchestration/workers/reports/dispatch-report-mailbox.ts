import type { OrchestrationDb } from '../../db/orchestration-db'
import type { DispatchContextRow, MessageType } from '../../db/orchestration-records'

export function federatedMessageNamesOnlyHome(
  params: { to?: string; run?: string },
  homeRunId: string
): boolean {
  return (
    (!params.to || params.to === `run:${homeRunId}`) && (!params.run || params.run === homeRunId)
  )
}

/** Reports about the worker's own task; gates and handoffs stay with the Run's coordinator. */
export function isDispatchReportType(type: MessageType | undefined): boolean {
  return (
    type === undefined ||
    type === 'worker_done' ||
    type === 'heartbeat' ||
    type === 'escalation' ||
    type === 'status'
  )
}

/** The live Dispatch that started this one in the same Run: the worker it reports to. */
export function activeCreatorDispatch(
  db: OrchestrationDb,
  dispatch: Pick<DispatchContextRow, 'creator_dispatch_id' | 'run_id'>
): DispatchContextRow | undefined {
  const creator = dispatch.creator_dispatch_id
    ? db.getDispatchContextById(dispatch.creator_dispatch_id)
    : undefined
  return creator &&
    creator.run_id === dispatch.run_id &&
    (creator.status === 'pending' || creator.status === 'dispatched')
    ? creator
    : undefined
}

/** RA: a settled creator keeps its helper's mail; it never falls through to a different parent. */
export function dispatchReportMailbox(
  _db: OrchestrationDb,
  dispatch: Pick<DispatchContextRow, 'creator_dispatch_id' | 'run_id'>
): string {
  return dispatch.creator_dispatch_id
    ? `dispatch:${dispatch.creator_dispatch_id}`
    : `run:${dispatch.run_id}`
}
