import { describe, expect, it } from 'vitest'
import { TerminalCreateParams, TerminalSplit, TerminalSetParent } from './terminal-unary-params'
import { WorktreeCreate } from './worktree-create-params'
import { WorkerStartParams } from './orchestration-worker-start-params'
import { CreateTerminalTab } from './session-tabs-schemas-params'
import { FederationAttachStartParams } from './orchestration-federation-start-params'

// RA: attachment requires explicit, nonempty identities on both sides.
it('validates terminal.setParent identities', () => {
  expect(TerminalSetParent.parse({ terminal: 'term_child', parent: 'term_parent' }))
    .toEqual({ terminal: 'term_child', parent: 'term_parent' })
  expect(TerminalSetParent.safeParse({ terminal: 'term_child', parent: '' }).success).toBe(false)
  expect(TerminalSetParent.safeParse({ terminal: 'term_child' }).success).toBe(false)
})

// RA: every independent terminal-creation RPC must retain the CLI's optional parent.
describe.each([
  ['terminal.create', TerminalCreateParams, { worktree: 'id:wt-1' }],
  ['terminal.split', TerminalSplit, { terminal: 'term_target' }],
  ['worktree.create', WorktreeCreate, { repo: 'id:repo', name: 'child', startupCommand: 'codex' }],
  ['orchestration.workerStart', WorkerStartParams, { from: 'term_authority', spec: 'work' }],
  ['session.tabs.createTerminal', CreateTerminalTab, { worktree: 'id:wt-1' }],
  ['orchestration.federationAttachStart', FederationAttachStartParams, {
    dispatchId: 'ctx', taskId: 'task', taskSpec: 'work', protocolVersion: 3, worktree: 'id:wt-1'
  }]
] as const)('%s lineage', (_name, schema, base) => {
  it('retains the creator separately from the target or dispatch authority', () => {
    expect(schema.parse({ ...base, parentTerminalHandle: 'term_creator' })).toMatchObject({
      parentTerminalHandle: 'term_creator'
    })
  })

  it('accepts older callers and rejects an empty parent identity', () => {
    expect(schema.safeParse(base).success).toBe(true)
    expect(schema.safeParse({ ...base, parentTerminalHandle: '' }).success).toBe(false)
  })
})
