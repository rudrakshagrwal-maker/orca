import { describe, expect, it, vi } from 'vitest'
import { getDefaultWorkspaceSession } from '../../shared/constants'
import { parseWorkspaceSession } from '../../shared/workspace-session-schema'
import type { WorkspaceSessionState } from '../../shared/workspace-session-state-types'
import type { ExecutionHostId } from '../../shared/execution-host'
import {
  configureAgentLaunchParentPersistence,
  getAgentLaunchParents,
  recordAgentLaunchParent
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

  it.each(['tab-parent', 'tab-child'])('drops the durable and live link when %s closes', (tab) => {
    const f = fixture()
    const runtime = f.attach('one')
    recordAgentLaunchParent(runtime, { kind: 'terminal', handle: 'child-one' }, 'parent-one')
    f.close(tab)
    expect(getAgentLaunchParents(runtime)?.size).toBe(0)
    expect(f.session().terminalLaunchParentsByPaneKey).toEqual({})
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
