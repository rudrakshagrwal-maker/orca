import type { AgentLaunchOutcome } from '../../shared/agent-launch-intent'

export type AgentLaunchParent = { parentTerminalHandle: string; sessionId?: string }

// RA: Runtime-local lineage uses existing launch/split events, with no hooks or polling.
const parentsByRuntime = new WeakMap<object, Map<string, AgentLaunchParent>>()

export function getAgentLaunchParents(runtime: object) {
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
}
