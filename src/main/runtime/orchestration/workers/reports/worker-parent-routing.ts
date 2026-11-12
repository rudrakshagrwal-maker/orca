import { isGroupAddress } from '../../addressing/groups/group-addressing'
import type { OrchestrationDb } from '../../db/orchestration-db'
import type { DispatchContextRow } from '../../db/orchestration-records'
import { OrchestrationError } from '../../orchestration-error'
import { dispatchReportMailbox } from './dispatch-report-mailbox'
import { formatOrcaSessionAddress } from '../../../../../shared/orca-session-address'
import type { OrchestrationCoordinatorKey } from '../../addressing/orchestration-caller-identity'
import { isDispatchAssignee } from '../../db/dispatch-context/dispatch-lookup'

export function workerSendRecipient(
  db: OrchestrationDb,
  own: DispatchContextRow | undefined,
  sender: OrchestrationCoordinatorKey,
  requested?: string
): string | undefined {
  if (!own) {
    return requested
  }
  // RA: naming one's own assignment is a report to its immediate parent, not a cross-parent send.
  if (requested === `dispatch:${own.id}`) return workerParentRecipient(db, own)
  const target = requested?.startsWith('dispatch:')
    ? db.getDispatchContextById(requested.slice(9))
    : undefined
  // RA: a worker coordinating its own child Run may address that Run's children, never siblings.
  const ownRun = requested?.startsWith('run:')
    ? db.getCoordinatedRun(sender, requested.slice(4))
    : requested && isGroupAddress(requested) && !requested.toLowerCase().startsWith('@worktree:')
      ? db.getCurrentRunForCoordinator(sender)
      : undefined
  return target?.creator_dispatch_id === own.id || ownRun
    ? requested
    : workerParentRecipient(db, own, requested)
}

export function reportingWorker(
  db: OrchestrationDb,
  sender: OrchestrationCoordinatorKey,
  address: string,
  processIncarnation: string | undefined
): DispatchContextRow | undefined {
  const dispatch =
    db.getActiveDispatchForIdentity(address, sender.paneKey ?? undefined) ??
    db.getLatestDispatchForTerminal(address, sender.paneKey ?? undefined)
  const current =
    dispatch &&
    isDispatchAssignee(dispatch, address, sender.paneKey) &&
    (!dispatch.process_incarnation ||
      db.isDispatchProcessCurrent({
        dispatchId: dispatch.id,
        paneKey: sender.paneKey,
        processIncarnation: processIncarnation ?? null
      }))
  if (dispatch && !current && (dispatch.status === 'pending' || dispatch.status === 'dispatched')) {
    throw new OrchestrationError(
      'consumer_fenced',
      'This process no longer owns its worker Dispatch. No mail was sent.'
    )
  }
  return current ? dispatch : undefined
}

export function assertDispatchParent(
  db: OrchestrationDb,
  dispatchId: string,
  sender: OrchestrationCoordinatorKey,
  own: DispatchContextRow | undefined
): void {
  const target = db.getDispatchContextById(dispatchId)
  if (
    !target ||
    target.creator_dispatch_id === own?.id ||
    (!target.creator_dispatch_id && db.getCoordinatedRun(sender, target.run_id))
  ) {
    return
  }
  throw new OrchestrationError(
    'consumer_fenced',
    `Dispatch ${dispatchId} belongs to another coordinator. No mail was sent.`
  )
}

// RA: an explicit address cannot let a worker skip its immediate parent.
export function workerParentRecipient(
  db: OrchestrationDb,
  dispatch: DispatchContextRow,
  requested?: string
): string {
  const parent = dispatchReportMailbox(db, dispatch)
  const run = db.getRun(dispatch.run_id)
  const aliases = new Set([
    parent,
    dispatch.creator_handle,
    dispatch.creator_orca_session_id
      ? formatOrcaSessionAddress(dispatch.creator_orca_session_id)
      : null,
    ...(!dispatch.creator_dispatch_id ? [`run:${dispatch.run_id}`, run?.coordinator_handle] : [])
  ])
  if (requested === undefined || aliases.has(requested)) {
    return parent
  }
  throw new OrchestrationError(
    'consumer_fenced',
    `Dispatch ${dispatch.id} belongs to another coordinator than ${requested}; its only parent mailbox is ${parent}. No effects were applied.`,
    { effectsApplied: false }
  )
}
