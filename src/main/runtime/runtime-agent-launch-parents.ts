import type { AgentLaunchOutcome } from '../../shared/agent-launch-intent'
import type { RuntimeStore } from './runtime-store-contract'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import { reconcileTerminalLaunchParents } from '../../shared/terminal-launch-lineage'

export type AgentLaunchParent = {
  parentTerminalHandle: string
  sessionId?: string
  childPaneKey?: string
  parentPaneKey?: string
}

type ParentStore = Pick<
  RuntimeStore,
  'getWorkspaceSession' | 'setWorkspaceSession' | 'getWorkspaceSessionHostIds'
>
type ParentPersistence = {
  getStore(): ParentStore | null
  getPaneKey(handle: string): string | null
  getHandle(paneKey: string): string | null
}
const persistenceByRuntime = new WeakMap<object, ParentPersistence>()

// RA: closures defer store access until the runtime has finished construction.
export function configureAgentLaunchParentPersistence(runtime: object, persistence: ParentPersistence) {
  persistenceByRuntime.set(runtime, persistence)
}

// RA: Runtime-local lineage uses existing launch/split events, with no hooks or polling.
const parentsByRuntime = new WeakMap<object, Map<string, AgentLaunchParent>>()

export function getAgentLaunchParents(runtime: object) {
  const persistence = persistenceByRuntime.get(runtime)
  const store = persistence?.getStore()
  if (store?.getWorkspaceSession && persistence) {
    let parents = parentsByRuntime.get(runtime)
    const savedChildren = new Set<string>()
    for (const hostId of store.getWorkspaceSessionHostIds?.() ?? [LOCAL_EXECUTION_HOST_ID]) {
      const session = store.getWorkspaceSession(hostId)
      const reconciled = reconcileTerminalLaunchParents(session)
      if (reconciled !== session) {
        store.setWorkspaceSession?.(reconciled, hostId)
      }
      for (const [childPaneKey, parentPaneKey] of Object.entries(
        reconciled.terminalLaunchParentsByPaneKey ?? {}
      )) {
        savedChildren.add(childPaneKey)
        const child = persistence.getHandle(childPaneKey)
        // A saved parent need not have been restored into a live PTY yet.
        const parent = persistence.getHandle(parentPaneKey)
        if (child) {
          parents ??= new Map()
          parents.set(child, {
            parentTerminalHandle: parent ?? '',
            childPaneKey,
            parentPaneKey
          })
        }
      }
    }
    if (parents) {
      for (const [child, parent] of parents) {
        if (parent.childPaneKey && !savedChildren.has(parent.childPaneKey)) {
          parents.delete(child)
        }
      }
      parentsByRuntime.set(runtime, parents)
    }
  }
  return parentsByRuntime.get(runtime)
}

export function recordAgentLaunchParent(
  runtime: object,
  child: AgentLaunchOutcome,
  parentTerminalHandle: string | undefined
): void {
  if (!parentTerminalHandle || child.handle === parentTerminalHandle) {
    return
  }
  let parents = parentsByRuntime.get(runtime)
  if (!parents) {
    parents = new Map()
    parentsByRuntime.set(runtime, parents)
  }
  // A replay or a reused terminal keeps its original launching parent.
  if (!parents.has(child.handle)) {
    parents.set(child.handle, {
      parentTerminalHandle,
      ...(child.kind === 'structured' ? { sessionId: child.sessionId } : {})
    })
  }
  const persistence = persistenceByRuntime.get(runtime)
  const store = persistence?.getStore()
  const childPaneKey = persistence?.getPaneKey(child.handle)
  const parentPaneKey = persistence?.getPaneKey(parents.get(child.handle)!.parentTerminalHandle)
  if (!store?.getWorkspaceSession || !childPaneKey || !parentPaneKey) {
    return
  }
  for (const hostId of store.getWorkspaceSessionHostIds?.() ?? [LOCAL_EXECUTION_HOST_ID]) {
    const session = store.getWorkspaceSession(hostId)
    const candidate = reconcileTerminalLaunchParents({
      ...session,
      terminalLaunchParentsByPaneKey: {
        [childPaneKey]: parentPaneKey,
        ...session.terminalLaunchParentsByPaneKey
      }
    })
    if (candidate.terminalLaunchParentsByPaneKey?.[childPaneKey]) {
      // RA: the first creator wins, including create-then-send and launch replays.
      if (!session.terminalLaunchParentsByPaneKey?.[childPaneKey]) {
        store.setWorkspaceSession?.(candidate, hostId)
      }
      parents.set(child.handle, {
        ...parents.get(child.handle)!,
        childPaneKey,
        parentPaneKey: candidate.terminalLaunchParentsByPaneKey[childPaneKey]
      })
      break
    }
  }
}
