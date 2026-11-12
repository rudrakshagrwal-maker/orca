import { describe, expect, it, vi } from 'vitest'
import { getDefaultWorkspaceSession } from '../../shared/constants'
import { parseWorkspaceSession } from '../../shared/workspace-session/workspace-session-schema'
import type { WorkspaceSessionState } from '../../shared/workspace-session/workspace-session-state-types'
import type { ExecutionHostId } from '../../shared/execution-host'
import {
  configureAgentLaunchParentPersistence,
  getAgentLaunchParents,
  recordAgentLaunchParent,
  setAgentLaunchParent,
  getAgentOrchestratorContexts
} from './runtime-agent-launch-parents'

const PARENT = 'tab-parent:11111111-1111-4111-8111-111111111111'
const CHILD = 'tab-child:22222222-2222-4222-8222-222222222222'

function fixture(hostId: ExecutionHostId = 'local') {
  let session: WorkspaceSessionState = {
    ...getDefaultWorkspaceSession(),
    terminalLayoutsByTabId: Object.fromEntries([PARENT, CHILD].map((key) => {
      const [tabId, leafId] = key.split(':')
      return [tabId, { root: { type: 'leaf', leafId }, activeLeafId: leafId, expandedLeafId: null }]
    }))
  }
  const store = {
    getWorkspaceSessionHostIds: () => [hostId],
    getWorkspaceSession: () => session,
    setWorkspaceSession: vi.fn((next: WorkspaceSessionState) => { session = next })
  }
  const attach = (suffix: string) => {
    const runtime = {}
    const handles = new Map([[`parent-${suffix}`, PARENT], [`child-${suffix}`, CHILD]])
    configureAgentLaunchParentPersistence(runtime, {
      getStore: () => store,
      getPaneKey: (handle) => handles.get(handle) ?? null,
      getHandle: (pane) => [...handles].find(([, key]) => key === pane)?.[0] ?? null
    })
    return runtime
  }
  return {
    attach,
    store,
    session: () => session,
    reload: () => {
      const parsed = parseWorkspaceSession(JSON.parse(JSON.stringify(session)))
      if (!parsed.ok) { throw new Error(parsed.error) }
      session = parsed.value
    },
    close: (tabId: string) => { delete session.terminalLayoutsByTabId[tabId] }
  }
}

// RA: test restart semantics, not just the process-local cache's shape.
describe('durable terminal launch parents', () => {
  it.each(['local', 'ssh:build-host'] as const)('restores lineage with replacement handles on %s', (host) => {
    const f = fixture(host)
    recordAgentLaunchParent(f.attach('old'), { kind: 'terminal', handle: 'child-old' }, 'parent-old')
    expect(f.session().terminalLaunchParentsByPaneKey).toEqual({ [CHILD]: PARENT })
    expect(f.store.setWorkspaceSession).toHaveBeenCalledWith(f.session(), host)
    f.reload()
    expect(getAgentLaunchParents(f.attach('new'))?.get('child-new')).toMatchObject({
      parentTerminalHandle: 'parent-new', parentPaneKey: PARENT
    })
  })

  it('retains the original creator through create-then-send and launch retries', () => {
    const f = fixture()
    const runtime = f.attach('one')
    recordAgentLaunchParent(runtime, { kind: 'terminal', handle: 'child-one' }, 'parent-one')
    recordAgentLaunchParent(runtime, { kind: 'terminal', handle: 'child-one' }, 'different-parent')
    expect(getAgentLaunchParents(runtime)?.get('child-one')?.parentTerminalHandle).toBe('parent-one')
    expect(f.store.setWorkspaceSession).toHaveBeenCalledTimes(1)
  })

  // RA: a closed parent survives as a durable ancestor; a closed child retires its edge.
  it('keeps a parent after closure and restart', () => {
    const f = fixture()
    const runtime = f.attach('one')
    recordAgentLaunchParent(runtime, { kind: 'terminal', handle: 'child-one' }, 'parent-one')
    f.close('tab-parent')
    f.reload()
    expect(getAgentLaunchParents(f.attach('new'))?.get('child-new')?.parentPaneKey).toBe(PARENT)
    expect(getAgentOrchestratorContexts(runtime)[CHILD]).toMatchObject({ parentPaneKey: PARENT })
  })

  it('drops a closed child link while keeping the parent crown after restart', () => {
    const f = fixture()
    const runtime = f.attach('one')
    recordAgentLaunchParent(runtime, { kind: 'terminal', handle: 'child-one' }, 'parent-one')
    f.close('tab-child')
    expect(getAgentLaunchParents(runtime)?.size).toBe(0)
    expect(f.session().terminalLaunchParentsByPaneKey).toEqual({})
    f.reload()
    expect(getAgentOrchestratorContexts(f.attach('new'))[PARENT]).toEqual({ hasLaunchedHelpers: true })
  })

  it('attaches existing terminals and rejects self-parenting and cycles', () => {
    const f = fixture()
    const runtime = f.attach('one')
    setAgentLaunchParent(runtime, 'child-one', 'parent-one')
    expect(f.session().terminalLaunchParentsByPaneKey).toEqual({ [CHILD]: PARENT })
    expect(() => setAgentLaunchParent(runtime, 'parent-one', 'child-one')).toThrow('cycle')
    expect(() => setAgentLaunchParent(runtime, 'parent-one', 'parent-one')).toThrow('different')
    expect(() => setAgentLaunchParent(runtime, 'missing', 'parent-one')).toThrow('live')
  })

  it('does not invent lineage for external callers or self launches', () => {
    const f = fixture()
    const runtime = f.attach('one')
    recordAgentLaunchParent(runtime, { kind: 'terminal', handle: 'child-one' }, undefined)
    recordAgentLaunchParent(runtime, { kind: 'terminal', handle: 'child-one' }, 'child-one')
    expect(getAgentLaunchParents(runtime)).toBeUndefined()
    expect(f.store.setWorkspaceSession).not.toHaveBeenCalled()
  })
})
