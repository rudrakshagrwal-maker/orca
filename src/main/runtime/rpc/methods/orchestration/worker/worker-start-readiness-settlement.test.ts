import {
  agentSessionLeaseFixture,
  agentSessionRecordFixture
} from '../../../../../../shared/agent-session/lifecycle/agent-session-record.test-fixture'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../orchestration/preamble', () => ({
  buildDispatchPreamble: () => 'preamble',
  dispatchPreambleSendOptions: (requestId: string) => ({ inputKind: 'orchestration', requestId })
}))
vi.mock('./worker-topology', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  monitorWorkerSetup: () => {}
}))

const { composerHoldsWorkerBrief, deliverAndSettleWorkerStartReadiness } = await import(
  './worker-start-readiness-settlement'
)

function settle(delivered: 'accepted' | undefined) {
  const db = {
    getWorkerDispatch: () => ({ state: 'starting' }),
    getLatestUnreadMessageSequence: () => undefined,
    markWorkerStartUnknown: vi.fn(() => ({
      stage: 'turn_start_unobserved',
      residual_resources: '[]'
    })),
    markWorkerDispatchReady: vi.fn(() => ({ state: 'ready', stage: 'ready' }))
  }
  const record = agentSessionRecordFixture(
    agentSessionLeaseFixture({ sessionId: 's1', runtimeFence: 1 })
  )
  const host = {
    deps: {
      store: {
        selectWritableRecord: () => ({ kind: 'writable' as const, record }),
        requireWritableRecord: () => record
      }
    },
    send: async () => ({
      ok: true,
      value: { clientMessageId: 'c1', submission: { dispatchState: 'pending', reason: null } }
    }),
    // undefined: the worker's agent was still starting when the wait ran out.
    waitForSendSettlement: async () =>
      delivered
        ? { value: { clientMessageId: 'c1', submission: { dispatchState: delivered } } }
        : undefined
  }
  const args = {
    runtime: {
      getNestedWorkerMaxDepth: () => 3,
      getTerminalOrchestrationCliCommand: () => 'orca'
    },
    db,
    run: { id: 'run_1' },
    task: { id: 't1', spec: 'do the thing' },
    dispatchId: 'd1',
    dispatchDepth: 0,
    structuredSession: { host, identity: { sessionId: 's1' } },
    terminalHandle: 'structured_worker_1',
    coordinatorHandle: 'term_c',
    devMode: undefined,
    requestId: 'r1',
    agent: 'claude',
    setupReceipt: {},
    launchReceipt: {},
    mode: {},
    timeoutMs: 60_000,
    readinessDeadline: Date.now() + 60_000,
    effects: [],
    terminalRevealWarning: undefined,
    onStage: () => {}
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fakes implement exactly the runtime, db and host members this settlement reaches.
  const receipt = deliverAndSettleWorkerStartReadiness(args as never)
  return { db, receipt }
}

describe('a structured worker whose agent outlasts the preamble wait', () => {
  it('parks as start-unknown instead of failing the start, and never names a screen to read', async () => {
    const { db, receipt } = settle(undefined)

    // Resolving, not throwing, is what keeps the worker's session: a throw tears it down.
    await expect(receipt).resolves.toMatchObject({
      state: 'outcome_unknown',
      turnStart: 'unobserved',
      nextCommands: [
        'orca orchestration worker-show --dispatch d1 --json',
        'orca orchestration worker-abandon --dispatch d1 --json'
      ]
    })
    expect(db.markWorkerStartUnknown).toHaveBeenCalledWith(
      'd1',
      'turn_start_unobserved',
      expect.stringContaining('delivered when the agent starts'),
      expect.anything()
    )
    expect(db.markWorkerDispatchReady).not.toHaveBeenCalled()
  })
})

describe('a terminal worker whose preamble delivery waited out a held paste', () => {
  it("observes its turn start only for what is left of the client's grace", async () => {
    vi.useFakeTimers()
    try {
      const prompt = {
        requestId: 'r1',
        stages: ['input_accepted'],
        provider: 'codex',
        observation: 'supported',
        processIncarnation: 'p1',
        generation: 1,
        baselineWorkingSequence: 0
      }
      const observeTerminalAgentPrompt = vi.fn(async () => ({
        ...prompt,
        stages: ['input_accepted', 'turn_started']
      }))
      const runtime = {
        getNestedWorkerMaxDepth: () => 3,
        getTerminalOrchestrationCliCommand: () => 'orca',
        // A Windows Codex rescue held the writer for 40 s of the 50 s grace.
        sendTerminalAgentPrompt: async () => {
          vi.setSystemTime(Date.now() + 40_000)
          return { handle: 'term_w', accepted: true, bytesWritten: 9, prompt }
        },
        getTerminalPromptRequestBinding: () => ({ processIncarnation: 'p1', generation: 1 }),
        observeTerminalAgentPrompt
      }
      const db = {
        getWorkerDispatch: () => ({ state: 'starting' }),
        getLatestUnreadMessageSequence: () => undefined,
        markWorkerDispatchReady: vi.fn(() => ({ state: 'ready', stage: 'ready' }))
      }
      const args = {
        runtime,
        db,
        run: { id: 'run_1' },
        task: { id: 't1', spec: 'do the thing' },
        dispatchId: 'd1',
        dispatchDepth: 0,
        structuredSession: undefined,
        terminalHandle: 'term_w',
        coordinatorHandle: 'term_c',
        devMode: undefined,
        requestId: 'r1',
        setupReceipt: {},
        launchReceipt: {},
        mode: {},
        timeoutMs: 60_000,
        readinessDeadline: Date.now() + 60_000,
        effects: [],
        terminalRevealWarning: undefined,
        onStage: () => {}
      }
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fakes implement exactly the runtime and db members this terminal settlement reaches.
      const receipt = deliverAndSettleWorkerStartReadiness(args as never)

      await expect(receipt).resolves.toMatchObject({ turnStart: 'observed' })
      expect(observeTerminalAgentPrompt).toHaveBeenCalledWith('term_w', prompt, 10_000)
    } finally {
      vi.useRealTimers()
    }
  })
})

// RA: the 9 Nov Codex worker (ctx_0f819f0cf30b) held its brief unsent; this is its captured draft.
const HELD_DRAFT = [
  'You are working inside Orca, a multi-agent IDE. You are a dispatched worker.',
  "Your coordinator's terminal handle is: term_c",
  'Your task ID is: t1',
  '',
  "Don't post to Slack, GitHub, or other ch[Pasted Content 6038 chars]"
].join('\n')

describe('composerHoldsWorkerBrief', () => {
  it('finds the brief in a held composer draft', () => {
    expect(composerHoldsWorkerBrief(HELD_DRAFT, 't1')).toBe(true)
  })

  it('finds a brief whose prefix the composer wrapped', () => {
    const wrapped = ['You are working inside Orca,', '  a multi-agent IDE.'].join('\n')
    expect(composerHoldsWorkerBrief(wrapped, 'x')).toBe(true)
  })

  it('ignores an empty or unrelated composer', () => {
    expect(composerHoldsWorkerBrief(undefined, 't1')).toBe(false)
    expect(composerHoldsWorkerBrief('', 't1')).toBe(false)
    expect(composerHoldsWorkerBrief('fix the build', 't1')).toBe(false)
  })
})

describe('a terminal worker whose Enter was swallowed', () => {
  function settleSwallowed(draft: string | undefined) {
    const prompt = {
      requestId: 'r1',
      stages: ['input_accepted'],
      provider: 'codex',
      observation: 'supported',
      processIncarnation: 'p1',
      generation: 1,
      baselineWorkingSequence: 0
    }
    let entered = false
    const sendTerminal = vi.fn(async () => {
      entered = true
      return { handle: 'term_w', accepted: true, bytesWritten: 1 }
    })
    const runtime = {
      getNestedWorkerMaxDepth: () => 3,
      getTerminalOrchestrationCliCommand: () => 'orca',
      sendTerminalAgentPrompt: async () => ({
        handle: 'term_w',
        accepted: true,
        bytesWritten: 9,
        prompt
      }),
      getTerminalPromptRequestBinding: () => ({ processIncarnation: 'p1', generation: 1 }),
      // The turn starts only once the second Enter lands.
      observeTerminalAgentPrompt: vi.fn(async () =>
        entered ? { ...prompt, stages: ['input_accepted', 'turn_started'] } : prompt
      ),
      readTerminal: vi.fn(async () => ({ handle: 'term_w', tail: [], draft })),
      sendTerminal,
      readLaunchedAgentForeground: async () => 'agent',
      subscribeToTerminalData: () => () => {}
    }
    const db = {
      getWorkerDispatch: () => ({ state: 'starting' }),
      getLatestUnreadMessageSequence: () => undefined,
      getWorkerTerminalResourceByOwner: () => undefined,
      markWorkerStartUnknown: vi.fn(() => ({
        stage: 'turn_start_unobserved',
        residual_resources: '[]'
      })),
      markWorkerDispatchReady: vi.fn(() => ({ state: 'ready', stage: 'ready' }))
    }
    const args = {
      runtime,
      db,
      run: { id: 'run_1' },
      task: { id: 't1', spec: 'do the thing' },
      dispatchId: 'd1',
      dispatchDepth: 0,
      structuredSession: undefined,
      terminalHandle: 'term_w',
      coordinatorHandle: 'term_c',
      devMode: undefined,
      requestId: 'r1',
      agent: 'codex',
      launchedAgent: 'codex',
      setupReceipt: {},
      launchReceipt: {},
      mode: {},
      timeoutMs: 60_000,
      readinessDeadline: Date.now() + 60_000,
      effects: [],
      terminalRevealWarning: undefined,
      onStage: () => {}
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fakes implement exactly the runtime and db members this terminal settlement reaches.
    const receipt = deliverAndSettleWorkerStartReadiness(args as never)
    return { receipt, sendTerminal, db }
  }

  it('presses Enter once when the composer holds the brief', async () => {
    const { receipt, sendTerminal } = settleSwallowed(HELD_DRAFT)
    await expect(receipt).resolves.toMatchObject({ turnStart: 'observed' })
    expect(sendTerminal).toHaveBeenCalledTimes(1)
    expect(sendTerminal).toHaveBeenCalledWith(
      'term_w',
      { enter: true },
      expect.objectContaining({ inputKind: 'orchestration' })
    )
  })

  it('never writes again when the composer does not show the brief', async () => {
    const { receipt, sendTerminal, db } = settleSwallowed('')
    await expect(receipt).resolves.toMatchObject({ turnStart: 'unobserved' })
    expect(sendTerminal).not.toHaveBeenCalled()
    expect(db.markWorkerStartUnknown).toHaveBeenCalled()
  })
})
