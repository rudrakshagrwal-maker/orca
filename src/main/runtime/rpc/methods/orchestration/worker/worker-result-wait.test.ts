import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../../../orchestration/db/orchestration-db'
import { createRootDispatch } from '../../../../orchestration/db/root-dispatch-test-fixture'
import { RuntimeMessageWaiters } from '../../../../orchestration/mailbox/runtime-message-waiters'
import { waitForWorkerResult } from './worker-result-wait'

describe('waiting for one worker report', () => {
  let db: OrchestrationDb
  afterEach(() => {
    db?.close()
    vi.useRealTimers()
  })
  function setup() {
    db = new OrchestrationDb(':memory:')
    const run = db.createRun({
      objective: 'Inspect parser',
      coordinatorHandle: 'term_coord',
      coordinatorPaneKey: 'tab_coord:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    })
    const task = db.createTask({ spec: 'Inspect parser', runId: run.id })
    const dispatch = createRootDispatch(db, task.id, 'term_worker')
    db.db
      .prepare("INSERT INTO worker_dispatches (dispatch_id, state) VALUES (?, 'ready')")
      .run(dispatch.id)
    const waiters = new RuntimeMessageWaiters()
    const runtime = {
      getOrchestrationDb: () => db,
      waitForMessage: waiters.wait.bind(waiters),
      ensureOrchestrationFederationRelay: () => {}
    }
    function report(outcome: 'succeeded' | 'failed', body: string) {
      const message = db.insertMessage({
        from: 'term_worker',
        to: `run:${run.id}`,
        runId: run.id,
        subject: 'Finished',
        body,
        type: 'worker_done'
      })
      db.settleWorkerReport({
        taskId: task.id,
        dispatchId: dispatch.id,
        outcome,
        result: body,
        observation: {
          id: `worker_report:${message.id}`,
          authorityId: 'home',
          homeReceivedAt: Date.now()
        }
      })
      waiters.notify(`run:${run.id}`)
      return message
    }
    return { runtime, run, task, dispatch, report, waiters }
  }

  it.each(['succeeded', 'failed'] as const)(
    'returns the exact %s report even when it arrives before waiting',
    async (outcome) => {
      const h = setup()
      const message = h.report(outcome, 'Parser finding: missing token.')
      await expect(waitForWorkerResult(h.runtime, h.dispatch.id, 1_000)).resolves.toMatchObject({
        dispatchId: h.dispatch.id,
        outcome,
        result: 'Parser finding: missing token.',
        timedOut: false
      })
      expect(db.getMessageById(message.id)?.read).toBe(0)
    }
  )

  it('ignores another worker completion and leaves all coordinator mail unread', async () => {
    const h = setup()
    let returned = false
    const pending = waitForWorkerResult(h.runtime, h.dispatch.id, 1_000).then((value) => {
      returned = true
      return value
    })
    const other = db.insertMessage({
      from: 'term_other',
      to: `run:${h.run.id}`,
      runId: h.run.id,
      subject: 'Other worker finished',
      type: 'worker_done',
      body: 'Unrelated result'
    })
    h.waiters.notify(`run:${h.run.id}`)
    await Promise.resolve()
    expect(returned).toBe(false)
    const own = h.report('succeeded', 'The requested result')
    await expect(pending).resolves.toMatchObject({
      result: 'The requested result',
      outcome: 'succeeded'
    })
    expect(db.getMessageById(other.id)?.read).toBe(0)
    expect(db.getMessageById(own.id)?.read).toBe(0)
  })

  it('times out without stopping the worker, and a later wait can retrieve its report', async () => {
    vi.useFakeTimers()
    const h = setup()
    const pending = waitForWorkerResult(h.runtime, h.dispatch.id, 1_000)
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(pending).resolves.toMatchObject({
      dispatchId: h.dispatch.id,
      timedOut: true,
      outcome: null
    })
    expect(db.getWorkerDispatch(h.dispatch.id)?.state).toBe('ready')
    h.report('succeeded', 'Completed later')
    await expect(waitForWorkerResult(h.runtime, h.dispatch.id, 1_000)).resolves.toMatchObject({
      result: 'Completed later',
      timedOut: false
    })
  })

  it('cancels on client disconnect without fencing or consuming anything', async () => {
    const h = setup()
    const abort = new AbortController()
    const pending = waitForWorkerResult(h.runtime, h.dispatch.id, 1_000, abort.signal)
    abort.abort()
    await expect(pending).resolves.toMatchObject({ cancelled: true, outcome: null })
    expect(db.getWorkerDispatch(h.dispatch.id)?.state).toBe('ready')
    expect(h.waiters.get(`run:${h.run.id}`)).toBeUndefined()
  })

  it('wakes when the worker is abandoned without a completion report', async () => {
    const h = setup()
    const pending = waitForWorkerResult(h.runtime, h.dispatch.id, 1_000)
    db.db
      .prepare("UPDATE worker_dispatches SET state = 'abandoned' WHERE dispatch_id = ?")
      .run(h.dispatch.id)
    db.crewChanges.notify()
    await expect(pending).resolves.toMatchObject({
      state: 'abandoned',
      outcome: null,
      timedOut: false
    })
  })
})
