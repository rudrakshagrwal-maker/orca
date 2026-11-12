import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOrchestrationRpcHarness } from '../rpc-test-harness'

const panes = {
  term_a: 'tab_a:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  term_b: 'tab_b:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  term_worker_a: 'tab_wa:cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  term_worker_b: 'tab_wb:dddddddd-dddd-4ddd-8ddd-dddddddddddd'
} as const

describe('parent-only orchestration routing', () => {
  const h = createOrchestrationRpcHarness()
  afterEach(() => h.cleanup())

  async function setup() {
    const state = h.setup(false)
    const { runtime, db, ctx } = state
    vi.mocked(runtime.getTerminalPaneKey).mockImplementation(
      (handle) => panes[handle as keyof typeof panes] ?? null
    )
    vi.spyOn(runtime, 'getTerminalCoordinatorIdentity').mockImplementation((handle) => ({
      processIncarnation: `process:${handle}`,
      agentSessionId: `claude:session:${handle}`
    }))
    vi.mocked(runtime.getTerminalProcessIncarnation).mockImplementation(
      (handle) => `process:${handle}`
    )
    const a = (await h.call(
      'orchestration.runCreate',
      { from: 'term_a', objective: 'A' },
      ctx
    )) as { run: { id: string } }
    const b = (await h.call(
      'orchestration.runCreate',
      { from: 'term_b', objective: 'B' },
      ctx
    )) as { run: { id: string } }
    const dispatch = (
      runId: string,
      parent: 'term_a' | 'term_b',
      worker: 'term_worker_a' | 'term_worker_b'
    ) =>
      db.createDispatchContext({
        taskId: db.createTask({ spec: `Work for ${parent}`, runId }).id,
        assigneeHandle: worker,
        assigneePaneKey: panes[worker],
        processIncarnation: `process:${worker}`,
        creator: {
          kind: 'terminal',
          handle: parent,
          paneKey: panes[parent],
          processIncarnation: `process:${parent}`,
          agentSessionId: `claude:session:${parent}`
        },
        maxDepth: 4
      })
    return {
      ...state,
      runA: a.run.id,
      runB: b.run.id,
      workerA: dispatch(a.run.id, 'term_a', 'term_worker_a'),
      workerB: dispatch(b.run.id, 'term_b', 'term_worker_b')
    }
  }

  it('keeps two coordinators and their workers isolated in one workspace', async () => {
    const { db, ctx, runA, runB, workerA } = await setup()
    await h.call(
      'orchestration.send',
      { from: 'term_worker_a', subject: 'A only', type: 'status' },
      ctx
    )
    await h.call(
      'orchestration.send',
      { from: 'term_worker_b', subject: 'B only', type: 'status' },
      ctx
    )
    expect(await h.call('orchestration.check', { terminal: 'term_a' }, ctx)).toMatchObject({
      runId: runA,
      messages: [{ subject: 'A only' }]
    })
    expect(await h.call('orchestration.check', { terminal: 'term_b' }, ctx)).toMatchObject({
      runId: runB,
      messages: [{ subject: 'B only' }]
    })
    expect(db.getDispatchContextById(workerA.id)).toMatchObject({
      creator_handle: 'term_a',
      creator_process_incarnation: 'process:term_a'
    })
  })

  it('refuses foreign check, inbox, reply, send and ask before taking or answering mail', async () => {
    const { db, ctx, runA, runB, workerA } = await setup()
    const question = db.createQuestion({
      runId: runA,
      dispatchId: workerA.id,
      askerHandle: 'term_worker_a',
      question: 'Proceed?'
    })
    for (const [method, params] of [
      ['orchestration.check', { terminal: 'term_b', run: runA }],
      ['orchestration.inbox', { from: 'term_b', terminal: `run:${runA}` }],
      ['orchestration.reply', { from: 'term_b', id: question.message.id, body: 'Wrong parent' }],
      ['orchestration.send', { from: 'term_worker_a', to: `run:${runB}`, subject: 'wrong parent' }],
      [
        'orchestration.ask',
        { from: 'term_worker_a', to: 'term_b', question: 'Wrong parent?', wait: false }
      ]
    ] as const) {
      await expect(h.call(method, params, ctx)).rejects.toMatchObject({ code: 'consumer_fenced' })
    }
    expect(db.getQuestion(question.message.id)?.status).toBe('pending')
    expect(await h.call('orchestration.check', { terminal: 'term_a' }, ctx)).toMatchObject({
      messages: [{ id: question.message.id }]
    })
  })

  it('does not give a pane replacement the Run and restores only the original provider session', async () => {
    const { db, runtime, ctx, runA } = await setup()
    vi.mocked(runtime.getTerminalPaneKey).mockImplementation((handle) =>
      handle === 'term_replacement' ? panes.term_a : (panes[handle as keyof typeof panes] ?? null)
    )
    expect(
      db.getCurrentRunForCoordinator({
        terminalHandle: 'term_replacement',
        paneKey: panes.term_a,
        orcaSessionId: null,
        processIncarnation: 'new-process',
        agentSessionId: 'claude:other'
      })
    ).toBeUndefined()
    vi.mocked(runtime.getTerminalCoordinatorIdentity).mockImplementation((handle) => ({
      processIncarnation: 'new-process',
      agentSessionId: handle === 'term_replacement' ? 'claude:session:term_a' : null
    }))
    expect(
      await h.call('orchestration.runCurrent', { from: 'term_replacement' }, ctx)
    ).toMatchObject({ run: { id: runA } })
    expect(db.getRun(runA)).toMatchObject({
      coordinator_handle: 'term_replacement',
      coordinator_process_incarnation: 'new-process'
    })
  })

  it('refuses a foreign --terminal even when the calling terminal has no Run', async () => {
    const { runtime, ctx, runA } = await setup()
    const unboundPane = 'tab_unbound:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    vi.spyOn(runtime, 'getTerminalHandleForPaneKey').mockReturnValue('term_unbound')
    vi.mocked(runtime.getLiveTerminalPaneKey).mockImplementation((handle) =>
      handle === 'term_unbound' ? unboundPane : (panes[handle as keyof typeof panes] ?? null)
    )
    await expect(
      h.call(
        'orchestration.check',
        { terminal: 'term_a', run: runA },
        {
          ...ctx,
          orchestrationCompatibilityEvidence: {
            terminalHandle: 'term_unbound',
            paneKey: unboundPane
          }
        }
      )
    ).rejects.toMatchObject({ code: 'consumer_fenced' })
  })
})
