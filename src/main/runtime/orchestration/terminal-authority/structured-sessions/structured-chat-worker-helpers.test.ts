// RA: helpers always report to their immediate parent, including after that parent settles.

import { describe, expect, it, vi } from 'vitest'
import { formatOrcaSessionAddress } from '../../../../../shared/orca-session-address'
import { testOrcaSessionId } from '../../../../../shared/orca-session-address-test-fixture'
import { idOf } from '../../../rpc/orchestration-session-caller-test-fixture'
import type { DispatchCreator } from '../../db/dispatch-depth'
import {
  COORDINATOR,
  PEER_CHAT,
  WAIT,
  WORKER_2_PANE,
  WORKER_PANE,
  call,
  coordinatorRunAndTask,
  db,
  dispatcher,
  openChat,
  request,
  restartRuntime,
  runtime
} from './structured-chat-coordinator-mail-rig.test-fixture'

const WORKER = formatOrcaSessionAddress(testOrcaSessionId(PEER_CHAT))
const HELPER = 'term_worker'
/** A helper's own helper, two levels below the Run's coordinator. */
const LEAF = 'term_worker_2'

async function refusal(method: string, params: Record<string, unknown>, sessionId: string) {
  const response = await dispatcher.dispatch(request(method, params, { sessionId }))
  if (response.ok) {
    throw new Error(`expected a refusal, got ${JSON.stringify(response)}`)
  }
  return response.error
}

/** The helper row worker-start reserves once the worker's authority resolved, in a live terminal. */
function reserveHelper(
  creatorDispatchId: string,
  creator: DispatchCreator = { kind: 'session', orcaSessionId: testOrcaSessionId(PEER_CHAT) },
  handle = HELPER,
  paneKey = WORKER_PANE
): { dispatchId: string; taskId: string } {
  const started = db.createStartingWorkerDispatch({
    creator,
    maxDepth: runtime.getNestedWorkerMaxDepth(),
    requiredCreatorDispatchId: creatorDispatchId,
    taskSpec: 'review the parser',
    taskRunId: db.getDispatchContextById(creatorDispatchId)!.run_id,
    taskParentId: db.getDispatchContextById(creatorDispatchId)!.task_id,
    startOptions: {}
  })
  db.prepareStartingWorkerAuthority({
    dispatchId: started.dispatch.id,
    handle,
    paneKey,
    processIncarnation: `runtime_test:${handle}:1`,
    worktreeId: 'repo::worker',
    effects: [],
    setupState: 'not_applicable'
  })
  db.markWorkerDispatchReady(started.dispatch.id)
  return { dispatchId: started.dispatch.id, taskId: started.task.id }
}

function helperSend(type: string, subject: string, helper: { dispatchId: string; taskId: string }) {
  return call('orchestration.send', {
    from: HELPER,
    type,
    subject,
    payload: JSON.stringify({ ...helper, outcome: 'succeeded' })
  })
}

function inboxOf(inbox: Record<string, unknown>) {
  const messages = Array.isArray(inbox.messages)
    ? inbox.messages.map((message: Record<string, unknown>) => ({
        id: String(message.id),
        subject: String(message.subject),
        type: String(message.type)
      }))
    : []
  return { deliveryId: inbox.deliveryId, messages }
}

/** A chat checks by its session; a terminal helper by its handle. */
async function check(caller: string, ack?: unknown) {
  const byTerminal = caller.startsWith('term_')
  return inboxOf(
    await call(
      'orchestration.check',
      { ...(byTerminal ? { terminal: caller } : {}), ...(ack ? { ack } : {}) },
      byTerminal ? {} : { sessionId: caller }
    )
  )
}

async function subjects(caller: string, ack?: unknown): Promise<string[]> {
  return (await check(caller, ack)).messages.map((message) => message.subject)
}

describe('a worker starting helpers on the Run it works for', () => {
  it('keeps helper reports and questions with their parent through settlement', async () => {
    await openChat(COORDINATOR)
    await openChat(PEER_CHAT)
    const { runId, taskId } = await coordinatorRunAndTask()
    const parent = idOf(
      (
        await call(
          'orchestration.dispatch',
          { task: taskId, to: WORKER },
          { sessionId: COORDINATOR }
        )
      ).dispatch
    )
    vi.spyOn(runtime, 'getNestedWorkerMaxDepth').mockReturnValue(2)

    // The coordinator seat no longer gates it: the worker reaches the helper-scope rules instead.
    expect(
      await refusal(
        'orchestration.workerStart',
        { run: runId, spec: 'review', terminal: HELPER },
        PEER_CHAT
      )
    ).toMatchObject({ code: 'invalid_argument', message: expect.stringContaining('--terminal') })

    const helper = reserveHelper(parent)
    expect(db.getDispatchContextById(helper.dispatchId)).toMatchObject({
      run_id: runId,
      creator_dispatch_id: parent,
      depth: 2
    })

    await helperSend('escalation', 'Blocked on fixtures', helper)
    const asked = call('orchestration.ask', { from: HELPER, question: 'Which parser?' })
    await vi.waitFor(
      () =>
        expect(db.db.prepare('SELECT COUNT(*) AS n FROM question_threads').get()).toEqual({ n: 1 }),
      WAIT
    )
    const inbox = await check(PEER_CHAT)
    const messages = inbox.messages
    expect(messages.map((message) => message.subject)).toEqual(['Blocked on fixtures', 'Question'])
    await call(
      'orchestration.reply',
      { id: messages.find((message) => message.type === 'question')!.id, body: 'the TOML one' },
      { sessionId: PEER_CHAT }
    )
    expect(await asked).toMatchObject({ answer: 'the TOML one' })

    expect(await subjects(COORDINATOR)).toEqual([])
    expect(await call('orchestration.runCurrent', {}, { sessionId: PEER_CHAT })).toEqual({
      run: null
    })

    // RA: settlement does not transfer later helper mail to the Run.
    expect(await subjects(PEER_CHAT, inbox.deliveryId)).toEqual([])
    await helperSend('escalation', 'Blocked again', helper)
    await call(
      'orchestration.send',
      {
        type: 'worker_done',
        subject: 'Parent done',
        payload: JSON.stringify({ taskId, dispatchId: parent, outcome: 'succeeded' })
      },
      { sessionId: PEER_CHAT }
    )
    await helperSend('worker_done', 'Helper done', helper)
    expect(await subjects(COORDINATOR)).toEqual(['Parent done'])
    expect(db.getAllMessages(`dispatch:${parent}`).map((message) => message.subject)).toEqual(
      expect.arrayContaining(['Blocked again', 'Helper done'])
    )
  })
})

/** The Run's coordinator, a dispatched chat, its terminal helper, and that helper's own helper. */
async function threeLevels() {
  const chat = await openChat(COORDINATOR)
  await openChat(PEER_CHAT)
  const { runId, taskId } = await coordinatorRunAndTask()
  const parent = idOf(
    (await call('orchestration.dispatch', { task: taskId, to: WORKER }, { sessionId: COORDINATOR }))
      .dispatch
  )
  vi.spyOn(runtime, 'getNestedWorkerMaxDepth').mockReturnValue(3)
  const middle = reserveHelper(parent)
  const leaf = reserveHelper(
    middle.dispatchId,
    { kind: 'terminal', handle: HELPER, paneKey: WORKER_PANE },
    LEAF,
    WORKER_2_PANE
  )
  return { chat, runId, middle, leaf }
}

describe('a helper whose creator settles between it and the Run', () => {
  it('retains questions and later reports with their immediate parent after settlement and restart', async () => {
    const { runId, middle, leaf } = await threeLevels()
    const mailbox = `dispatch:${middle.dispatchId}`
    const question = db.createQuestion({
      runId,
      dispatchId: leaf.dispatchId,
      askerHandle: LEAF,
      question: 'Which parser?',
      to: mailbox
    })
    await helperSend('worker_done', 'Middle done', middle)
    await call('orchestration.send', { from: LEAF, type: 'status', subject: 'Leaf status' })
    expect(await subjects(COORDINATOR)).toEqual([])
    expect(
      db
        .getAllMessages(mailbox)
        .map((message) => message.subject)
        .sort()
    ).toEqual(['Leaf status', 'Question'])
    expect(
      await refusal(
        'orchestration.reply',
        { id: question.message.id, body: 'Wrong parent' },
        COORDINATOR
      )
    ).toMatchObject({ code: 'consumer_fenced' })
    restartRuntime()
    expect(
      db
        .getAllMessages(mailbox)
        .map((message) => message.subject)
        .sort()
    ).toEqual(['Leaf status', 'Question'])
  })
})
