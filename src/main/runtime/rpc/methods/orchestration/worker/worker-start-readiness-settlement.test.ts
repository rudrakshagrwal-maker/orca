import { describe, expect, it, vi } from 'vitest'

// RA: test settlement recovery without recreating upstream's dispatch/structured-session suites.
vi.mock('./deliver-worker-dispatch-preamble', () => ({
  deliverWorkerDispatchPreamble: async ({
    runtime,
    terminalHandle
  }: {
    runtime: { sendTerminalAgentPrompt(handle: string): Promise<{ prompt: unknown }> }
    terminalHandle: string
  }) => runtime.sendTerminalAgentPrompt(terminalHandle)
}))
vi.mock('./worker-topology', () => ({ monitorWorkerSetup: () => {} }))
vi.mock('./worker-start-receipt', () => ({ reportedWorkerOutcome: () => undefined }))
vi.mock('../../../../orchestration/workers/lifecycle/chat-assignee', () => ({
  chatAssigneeSessionId: () => null
}))

const { deliverAndSettleWorkerStartReadiness } = await import('./worker-start-readiness-settlement')

// RA: the 9 Nov Codex worker (ctx_0f819f0cf30b) held its brief unsent; this is its captured draft.
const HELD_DRAFT = [
  'You are working inside Orca, a multi-agent IDE. You are a dispatched worker.',
  "Your coordinator's terminal handle is: term_c",
  'Your task ID is: t1',
  '',
  "Don't post to Slack, GitHub, or other ch[Pasted Content 6038 chars]"
].join('\n')

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
