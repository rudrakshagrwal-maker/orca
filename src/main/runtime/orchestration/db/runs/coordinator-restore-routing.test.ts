import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'

it('preserves coordinator custody across database reopen and the same saved session restore', () => {
  const directory = mkdtempSync(join(tmpdir(), 'orca-coordinator-restore-'))
  const path = join(directory, 'orchestration.db')
  let db = new OrchestrationDb(path)
  try {
    const paneKey = 'tab:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const run = db.createRun({
      objective: 'restore',
      coordinatorHandle: 'term_original',
      coordinatorPaneKey: paneKey,
      coordinatorProcessIncarnation: 'old-process',
      coordinatorAgentSessionId: 'claude:saved-session'
    })
    const message = db.insertMessage({
      from: 'term_worker',
      to: `run:${run.id}`,
      runId: run.id,
      subject: 'Waiting for my coordinator',
      type: 'status'
    })
    db.close()
    db = new OrchestrationDb(path)
    const restored = {
      terminalHandle: 'term_restored',
      paneKey,
      orcaSessionId: null,
      processIncarnation: 'new-process',
      agentSessionId: 'claude:saved-session'
    }
    expect(
      db.getCurrentRunForCoordinator({ ...restored, agentSessionId: 'claude:different-session' })
    ).toBeUndefined()
    expect(db.getMessageById(message.id)?.read).toBe(0)
    expect(db.getCurrentRunForCoordinator(restored)?.id).toBe(run.id)
    expect(db.getRun(run.id)?.coordinator_handle).toBe('term_restored')
    expect(db.getUnreadMessages(`run:${run.id}`).map((item) => item.subject)).toEqual([
      'Waiting for my coordinator'
    ])
  } finally {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
