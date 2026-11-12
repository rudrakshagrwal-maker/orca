import type { OrchestrationDb } from '../orchestration-db'

// RA: bind coordinators to a process, with a saved provider session for cold restore.
export function migrateV47(this: OrchestrationDb, current: number): void {
  if (current >= 47) {
    return
  }
  for (const [table, column] of [
    ['runs', 'coordinator_process_incarnation'],
    ['runs', 'coordinator_agent_session_id'],
    ['dispatch_contexts', 'creator_process_incarnation'],
    ['dispatch_contexts', 'creator_agent_session_id']
  ] as const) {
    if (!this.hasColumn(table, column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT`)
    }
  }
  this.db.exec(`UPDATE dispatch_contexts SET creator_process_incarnation = (
    SELECT created_by_process_incarnation FROM tasks
    WHERE tasks.id = dispatch_contexts.task_id
      AND tasks.created_by_terminal_handle = dispatch_contexts.creator_handle
  ) WHERE creator_process_incarnation IS NULL AND creator_handle IS NOT NULL`)
}
