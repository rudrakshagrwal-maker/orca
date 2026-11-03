import { describe, expect, it } from 'vitest'
import { getDefaultWorkspaceSession } from './constants'
import { parseWorkspaceSession } from './workspace-session-schema'
import { reconcileTerminalLaunchParents } from './terminal-launch-lineage'
import type { WorkspaceSessionState } from './workspace-session-state-types'

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

  it.each(['parent', 'child'])('drops links when the %s pane closes', (tab) => {
    const value = session()
    delete value.terminalLayoutsByTabId[tab]
    expect(reconcileTerminalLaunchParents(value).terminalLaunchParentsByPaneKey).toEqual({})
  })

  it('keeps relationships when either pane moves to a new tab', () => {
    const value = session()
    value.terminalLayoutsByTabId.detached = value.terminalLayoutsByTabId.child
    delete value.terminalLayoutsByTabId.child
    expect(reconcileTerminalLaunchParents(value).terminalLaunchParentsByPaneKey)
      .toEqual({ [`detached:${CHILD_LEAF}`]: PARENT })
  })
})
