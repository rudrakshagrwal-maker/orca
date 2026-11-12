import type { AgentLaunchOutcome } from '../../shared/agent-launch/contracts/agent-launch-intent'
import type { RuntimeStore } from './construction/runtime-store-contract'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import { reconcileTerminalLaunchParents } from '../../shared/terminal-launch-lineage'
import type { AgentStatusOrchestrationContext } from '../../shared/agent-status/contracts/agent-status-types'

export type AgentLaunchParent = {
  parentTerminalHandle: string
  sessionId?: string
  childPaneKey?: string
  parentPaneKey?: string
  // RA: closed parent labels are independent of process-local handles.
  parentTitle?: string
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
            parentPaneKey,
            parentTitle: reconciled.terminalOrchestratorTitlesByPaneKey?.[parentPaneKey]
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
  parentTerminalHandle: string | undefined,
  // RA: explicit attachment may replace a launch parent; ordinary launch replays may not.
  replace = false
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
  if (replace || !parents.has(child.handle)) {
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
        ...session.terminalLaunchParentsByPaneKey,
        [childPaneKey]: replace
          ? parentPaneKey
          : (session.terminalLaunchParentsByPaneKey?.[childPaneKey] ?? parentPaneKey)
      }
    })
    if (candidate.terminalLaunchParentsByPaneKey?.[childPaneKey]) {
      // RA: the first creator wins, including create-then-send and launch replays.
      if (replace || !session.terminalLaunchParentsByPaneKey?.[childPaneKey]) {
        store.setWorkspaceSession?.(candidate, hostId)
      }
      parents.set(child.handle, {
        ...parents.get(child.handle)!,
        childPaneKey,
        parentPaneKey: candidate.terminalLaunchParentsByPaneKey[childPaneKey],
        parentTitle: candidate.terminalOrchestratorTitlesByPaneKey?.[parentPaneKey]
      })
      break
    }
  }
}

// RA: publish lifetime crowns even after the last helper has closed.
export function getAgentOrchestratorContexts(runtime: object): Record<string, AgentStatusOrchestrationContext> {
  const store = persistenceByRuntime.get(runtime)?.getStore()
  const contexts: Record<string, AgentStatusOrchestrationContext> = {}
  for (const host of store?.getWorkspaceSessionHostIds?.() ?? [LOCAL_EXECUTION_HOST_ID]) {
    // RA: lightweight runtime stores may omit the session reader itself.
    const session = store?.getWorkspaceSession?.(host)
    for (const paneKey of Object.keys(session?.terminalOrchestratorTitlesByPaneKey ?? {})) {
      contexts[paneKey] = { ...contexts[paneKey], hasLaunchedHelpers: true }
    }
    for (const [child, parent] of Object.entries(session?.terminalLaunchParentsByPaneKey ?? {})) {
      contexts[child] = { ...contexts[child], parentPaneKey: parent,
        parentTitle: session?.terminalOrchestratorTitlesByPaneKey?.[parent] }
    }
  }
  return contexts
}

// RA: explicit attachment validates both pane identities and refuses ancestry cycles.
export function setAgentLaunchParent(runtime: object, child: string, parent: string): void {
  const persistence = persistenceByRuntime.get(runtime)
  const childPaneKey = persistence?.getPaneKey(child)
  const parentPaneKey = persistence?.getPaneKey(parent)
  if (!childPaneKey || !parentPaneKey || childPaneKey === parentPaneKey) {
    throw Object.assign(new Error('Choose two different live terminal panes.'), { code: 'invalid_argument' })
  }
  const links = new Map<string, string>()
  const store = persistence?.getStore()
  for (const host of store?.getWorkspaceSessionHostIds?.() ?? [LOCAL_EXECUTION_HOST_ID]) {
    // RA: a store without session persistence still supports in-memory parent attachment.
    for (const [pane, ancestor] of Object.entries(
      store?.getWorkspaceSession?.(host)?.terminalLaunchParentsByPaneKey ?? {}
    )) {
      links.set(pane, ancestor)
    }
  }
  const visited = new Set([childPaneKey])
  for (let pane: string | undefined = parentPaneKey; pane; pane = links.get(pane)) {
    if (visited.has(pane)) {
      throw Object.assign(new Error('Parent assignment would create an ancestry cycle.'), { code: 'invalid_argument' })
    }
    visited.add(pane)
  }
  recordAgentLaunchParent(runtime, { kind: 'terminal', handle: child }, parent, true)
}
