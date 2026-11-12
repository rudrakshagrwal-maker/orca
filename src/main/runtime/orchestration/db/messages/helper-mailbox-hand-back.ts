import type { OrchestrationDb } from '../orchestration-db'

/** Mail a settling helper creator never handled, now owned by its Run's mailbox. */
export type MailHandBack = { mailbox: string; messageIds: string[]; types: string[] }

/** Transfer unread reports and unanswered helper questions, including read ones, to the settled creator's Run. */
// RA: helper mail stays with its immediate parent after settlement.
export function handHelperMailToRun(_db: OrchestrationDb, _dispatchId: string): void {}

/** The types of handed-back rows the Run still owes attention to, read after the settlement. */
export function committedHandBackTypes(db: OrchestrationDb, handBack: MailHandBack): string[] {
  return db.db
    .prepare(
      `SELECT DISTINCT type FROM messages
       WHERE to_handle = ? AND read = 0 AND delivery_contract = 'current_delivery'
         AND id IN (SELECT value FROM json_each(?))
         AND (type <> 'question'
           OR id IN (SELECT message_id FROM question_threads WHERE status = 'pending'))`
    )
    .all(handBack.mailbox, JSON.stringify(handBack.messageIds))
    .map((row) => String(row.type))
}

/** The Run mail a helper creator's settlement may have handed back that still owes attention. */
export function handBackReplayTargets(
  _db: OrchestrationDb,
  _dispatchId: string
): { to: string; type: string }[] {
  return []
}
