import { describe, expect, it, vi } from 'vitest'
import { OrchestrationMailboxDeliveryTarget } from './mailbox-delivery-target'
import { OrchestrationDb } from '../../db/orchestration-db'

describe('OrchestrationMailboxDeliveryTarget absence probe', () => {
  it('leaves mail pending when another agent replaces the coordinator pane', () => {
    const db = new OrchestrationDb(':memory:')
    try {
      const paneKey = 'tab:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      const run = db.createRun({
        objective: 'original',
        coordinatorHandle: 'term_parent',
        coordinatorPaneKey: paneKey,
        coordinatorProcessIncarnation: 'original-process',
        coordinatorAgentSessionId: 'claude:original'
      })
      const replacement = {
        ptyId: 'pty-other',
        handle: 'term_other',
        paneKeys: [paneKey],
        lastAgentStatus: 'idle' as const,
        lastAgentStatusObservedLive: true,
        processIncarnation: 'other-process',
        agentSessionId: 'claude:other'
      }
      const target = new OrchestrationMailboxDeliveryTarget({
        getDb: () => db,
        getMailboxTerminalForPaneKey: () => replacement,
        getTerminalForHandle: () => null,
        hasTerminalHandle: () => false,
        isStructuredSessionOwner: () => false,
        canProbePtyLiveness: () => false,
        controllerKnowsPtyIsLive: () => true,
        isLeafPtyProvenAbsent: async () => false
      })
      expect(target.resolveTerminal(`run:${run.id}`)).toBeNull()
      replacement.agentSessionId = 'claude:original'
      expect(target.resolveTerminal(`run:${run.id}`)?.handle).toBe('term_other')
    } finally {
      db.close()
    }
  })
  it('redelivers every mailbox that deferred on one probe of a shared PTY', async () => {
    vi.useFakeTimers()
    let answer: (absent: boolean) => void = () => {}
    const target = new OrchestrationMailboxDeliveryTarget({
      getDb: () => null,
      getMailboxTerminalForPaneKey: () => null,
      getTerminalForHandle: () => null,
      hasTerminalHandle: () => true,
      isStructuredSessionOwner: () => false,
      canProbePtyLiveness: () => true,
      controllerKnowsPtyIsLive: () => false,
      isLeafPtyProvenAbsent: () => new Promise((resolve) => (answer = resolve))
    })
    const redeliver = vi.fn()

    expect(target.deferForAbsenceProbe('pty-coordinator', 'run:run_a', false, redeliver)).toBe(true)
    expect(target.deferForAbsenceProbe('pty-coordinator', 'run:run_b', false, redeliver)).toBe(true)
    answer(false)
    await vi.runAllTimersAsync()

    expect(redeliver.mock.calls.map(([mailbox]) => mailbox)).toEqual(['run:run_a', 'run:run_b'])
    vi.useRealTimers()
  })
})
