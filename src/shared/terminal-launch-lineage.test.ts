import { describe, expect, it } from 'vitest'
import { getDefaultWorkspaceSession } from './constants'
import { parseWorkspaceSession } from './workspace-session/workspace-session-schema'
import { reconcileTerminalLaunchParents } from './terminal-launch-lineage'
import type { WorkspaceSessionState } from './workspace-session/workspace-session-state-types'

const PARENT_LEAF = '11111111-1111-4111-8111-111111111111'
const CHILD_LEAF = '22222222-2222-4222-8222-222222222222'
const PARENT = `parent:${PARENT_LEAF}`
const CHILD = `child:${CHILD_LEAF}`
function session(): WorkspaceSessionState {
  return {
    ...getDefaultWorkspaceSession(),
    terminalLaunchParentsByPaneKey: { [CHILD]: PARENT },
    terminalLayoutsByTabId: {
      parent: { root: { type: 'leaf', leafId: PARENT_LEAF }, activeLeafId: PARENT_LEAF, expandedLeafId: null },
      child: { root: { type: 'leaf', leafId: CHILD_LEAF }, activeLeafId: CHILD_LEAF, expandedLeafId: null }
    }
  }
}

// RA: renderer snapshots and topology edits must agree on durable membership.
describe('terminal launch lineage session state', () => {
  it('round trips and salvages a malformed independent entry', () => {
    const value = session()
    const parsed = parseWorkspaceSession({
      ...value, terminalLaunchParentsByPaneKey: { ...value.terminalLaunchParentsByPaneKey, bad: 12 }
    })
    if (!parsed.ok) { throw new Error(parsed.error) }
    expect(parsed.value.terminalLaunchParentsByPaneKey).toEqual({ [CHILD]: PARENT })
  })

  // RA: closing a child retires its link; closing its parent preserves a dim ancestor row.
  it('drops a closed child but retains its live parent crown', () => {
    const value = reconcileTerminalLaunchParents(session())
    delete value.terminalLayoutsByTabId.child
    const result = reconcileTerminalLaunchParents(value)
    expect(result.terminalLaunchParentsByPaneKey).toEqual({})
    expect(result.terminalOrchestratorTitlesByPaneKey).toEqual({ [PARENT]: 'Agent' })
  })

  it('keeps the closed parent identity while its child survives', () => {
    const value = session()
    delete value.terminalLayoutsByTabId.parent
    expect(reconcileTerminalLaunchParents(value).terminalLaunchParentsByPaneKey).toEqual({ [CHILD]: PARENT })
  })

  it('retains closed intermediate ancestors and prunes them after the last descendant closes', () => {
    const value = session()
    const grandchild = 'grandchild:33333333-3333-4333-8333-333333333333'
    value.terminalLaunchParentsByPaneKey![grandchild] = CHILD
    value.terminalLayoutsByTabId.grandchild = {
      root: { type: 'leaf', leafId: grandchild.split(':')[1] },
      activeLeafId: grandchild.split(':')[1], expandedLeafId: null
    }
    delete value.terminalLayoutsByTabId.parent
    delete value.terminalLayoutsByTabId.child
    const kept = reconcileTerminalLaunchParents(value)
    expect(kept.terminalLaunchParentsByPaneKey).toEqual({ [CHILD]: PARENT, [grandchild]: CHILD })
    delete kept.terminalLayoutsByTabId.grandchild
    expect(reconcileTerminalLaunchParents(kept).terminalLaunchParentsByPaneKey).toEqual({})
    expect(reconcileTerminalLaunchParents(kept).terminalOrchestratorTitlesByPaneKey).toEqual({})
  })

  it('keeps relationships when either pane moves to a new tab', () => {
    const value = session()
    value.terminalLayoutsByTabId.detached = value.terminalLayoutsByTabId.child
    delete value.terminalLayoutsByTabId.child
    expect(reconcileTerminalLaunchParents(value).terminalLaunchParentsByPaneKey)
      .toEqual({ [`detached:${CHILD_LEAF}`]: PARENT })
  })
})
