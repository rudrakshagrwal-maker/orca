import { rmSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../terminal-pointer/mailbox-pointer-state'
import {
  createBoundRun,
  createDatabase,
  createRuntime,
  insertDirectRunMessage,
  PANE_KEY,
  SECOND_PANE_KEY,
  temporaryDirectories,
  TERMINAL_HANDLE
} from '../terminal-pointer/orchestration-mailbox-notification-test-harness'
import {
  checkBoundMailbox,
  dispatchMailboxCheck
} from '../terminal-pointer/orchestration-mailbox-check.test-fixture'
import { createRootDispatch } from '../../db/root-dispatch-test-fixture'

describe('orchestration mailbox routing races', () => {
  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('fences a Run consumer rebound during a routing-page yield', async () => {
    const db = createDatabase('orca-mailbox-run-routing-fence-')
    const harness = createRuntime(db)
    const run = createBoundRun(db, 'Run routing fence')
    for (let index = 0; index < 51; index += 1) {
      insertDirectRunMessage(db, run.id, `Before rebind ${index}`)
    }
    const route = db.routeUnreadDirectMessagesToRunMailbox.bind(db)
    let scheduled = false
    vi.spyOn(db, 'routeUnreadDirectMessagesToRunMailbox').mockImplementation((...args) => {
      const page = route(...args)
      if (page.hasMore && !scheduled) {
        scheduled = true
        setImmediate(() =>
          db.bindRun({
            runId: run.id,
            coordinatorHandle: 'term_replacement',
            coordinatorPaneKey: SECOND_PANE_KEY
          })
        )
      }
      return page
    })

    const response = await dispatchMailboxCheck(harness.runtime)

    expect(response).toMatchObject({ ok: false, error: { code: 'consumer_fenced' } })
    expect(db.getUnreadMessages(`run:${run.id}`)).toHaveLength(51)
    db.close()
  })

  it('drains current and stored Run handles in one check', async () => {
    const db = createDatabase('orca-mailbox-split-run-handles-')
    const harness = createRuntime(db)
    const run = db.createRun({
      objective: 'Split Run handles',
      coordinatorHandle: 'term_previous_coordinator',
      coordinatorPaneKey: PANE_KEY
    })
    const current = insertDirectRunMessage(db, run.id, 'Current handle')
    const previous = db.insertMessage({
      from: 'term_worker',
      to: 'term_previous_coordinator',
      subject: 'Previous handle',
      type: 'status',
      runId: run.id
    })

    const checked = await checkBoundMailbox(harness.runtime)

    // RA: a same-pane replacement does not inherit its predecessor's direct mailbox.
    expect(checked.messages).toEqual([expect.objectContaining({ id: current.id })])
    expect(db.getUnreadMessages('term_previous_coordinator').map((row) => row.id)).toContain(previous.id)
    db.close()
  })

  it('drains current and stored Dispatch handles in one check', async () => {
    const db = createDatabase('orca-mailbox-split-dispatch-handles-')
    const harness = createRuntime(db)
    const run = db.createRun({
      objective: 'Split Dispatch handles',
      coordinatorHandle: 'term_coordinator',
      coordinatorPaneKey:
        '55555555-5555-4555-8555-555555555555:66666666-6666-4666-8666-666666666666'
    })
    const task = db.createTask({ spec: 'Worker task', runId: run.id })
    createRootDispatch(db, task.id, 'term_previous_worker', PANE_KEY)
    const current = insertDirectRunMessage(db, run.id, 'Current worker handle')
    const previous = db.insertMessage({
      from: 'term_coordinator',
      to: 'term_previous_worker',
      subject: 'Previous worker handle',
      type: 'status',
      runId: run.id
    })

    const checked = await checkBoundMailbox(harness.runtime)

    expect(checked.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: current.id }),
        expect.objectContaining({ id: previous.id })
      ])
    )
    db.close()
  })

  it('routes only the direct-mail snapshot captured when the check starts', async () => {
    const db = createDatabase('orca-mailbox-routing-snapshot-')
    const harness = createRuntime(db)
    const run = createBoundRun(db, 'Routing snapshot')
    for (let index = 0; index < 51; index += 1) {
      insertDirectRunMessage(db, run.id, `Initial ${index}`)
    }
    const route = db.routeUnreadDirectMessagesToRunMailbox.bind(db)
    let inserted = false
    const routeSpy = vi
      .spyOn(db, 'routeUnreadDirectMessagesToRunMailbox')
      .mockImplementation((...args) => {
        const page = route(...args)
        if (page.hasMore && !inserted) {
          inserted = true
          for (let index = 0; index < 60; index += 1) {
            insertDirectRunMessage(db, run.id, `Concurrent ${index}`)
          }
        }
        return page
      })

    await checkBoundMailbox(harness.runtime)

    expect(routeSpy).toHaveBeenCalledTimes(2)
    expect(db.getUnreadMessages(TERMINAL_HANDLE)).toHaveLength(60)
    db.close()
  })
})
