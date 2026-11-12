import type { AgentStatusOrchestrationContext } from '../../shared/agent-status/contracts/agent-status-types'
import type { AgentLaunchParent } from './runtime-agent-launch-parents'
import {
  RuntimeAgentOrchestrationProjection as UpstreamAgentOrchestrationProjection,
  type RuntimeAgentOrchestrationDependencies as UpstreamAgentOrchestrationDependencies,
  type DispatchProjectionOptions
} from './orchestration/crew/runtime-agent-orchestration-projection'
import { createOrchestrationProjectionScope } from './orchestration/crew/runtime-agent-orchestration-scope'

export type RuntimeAgentOrchestrationDependencies = UpstreamAgentOrchestrationDependencies & {
  getLaunchParents?(): Map<string, AgentLaunchParent> | undefined
  getOrchestratorContexts?(): Record<string, AgentStatusOrchestrationContext>
}

// RA: retain CLI launch ancestry over upstream's restart-safe Orchestrator V3 projection.
export class RuntimeAgentOrchestrationProjection extends UpstreamAgentOrchestrationProjection {
  constructor(private readonly lineageDeps: RuntimeAgentOrchestrationDependencies) {
    super(lineageDeps)
  }

  override buildByPaneKey(): Record<string, AgentStatusOrchestrationContext> | undefined {
    return this.withLaunchParents(super.buildByPaneKey())
  }

  override getForHandle(
    handle: string,
    db = this.lineageDeps.getDb(),
    options: DispatchProjectionOptions = {},
    scope = createOrchestrationProjectionScope(db, this.lineageDeps)
  ): AgentStatusOrchestrationContext | undefined {
    const context = super.getForHandle(handle, db, options, scope)
    const parent = this.launchParentContext(handle)
    if (!context && !parent) {
      return undefined
    }
    return context?.parentTerminalHandle || context?.parentPaneKey
      ? context
      : { ...context, ...parent }
  }

  // RA: Merge launch ancestry after dispatch attention; never invent task/dispatch IDs.
  private withLaunchParents(
    contexts: Record<string, AgentStatusOrchestrationContext> = {},
    scope?: ReturnType<typeof createOrchestrationProjectionScope>
  ): Record<string, AgentStatusOrchestrationContext> | undefined {
    const parents = this.lineageDeps.getLaunchParents?.()
    for (const [handle, parent] of parents ?? []) {
      // RA: even unsaved ancestry retains a closed parent handle for its dim sidebar row.
      let paneKey = this.lineageDeps.getPaneKey(handle)
      if (parent.sessionId) {
        scope ??= createOrchestrationProjectionScope(null, this.lineageDeps)
        paneKey = scope.resolve(parent.sessionId)
      }
      if (!paneKey) {
        // Drop retired terminal children on the existing publication path.
        if (!parent.sessionId && this.lineageDeps.getWorktreeId(handle) === null) {
          parents?.delete(handle)
        }
        continue
      }
      const context = contexts[paneKey]
      if (!context?.parentTerminalHandle && !context?.parentPaneKey) {
        const launchParent = this.launchParentContext(handle, parent)
        if (launchParent && launchParent.parentPaneKey !== paneKey) {
          contexts[paneKey] = { ...context, ...launchParent }
        }
      }
    }
    // RA: a parent keeps its crown after all helpers finish or close.
    for (const [paneKey, saved] of Object.entries(
      this.lineageDeps.getOrchestratorContexts?.() ?? {}
    )) {
      contexts[paneKey] = { ...contexts[paneKey], ...saved }
    }
    return Object.keys(contexts).length > 0 ? contexts : undefined
  }

  private launchParentContext(
    handle: string,
    parent = this.lineageDeps.getLaunchParents?.()?.get(handle)
  ): AgentStatusOrchestrationContext | undefined {
    if (!parent) {
      return undefined
    }
    const parentPaneKey =
      parent.parentPaneKey ?? this.lineageDeps.getPaneKey(parent.parentTerminalHandle)
    return {
      parentTerminalHandle: parent.parentTerminalHandle,
      ...(parentPaneKey ? { parentPaneKey } : {}),
      // RA: preserve a useful label when the parent tab is closed.
      ...(parent.parentTitle ? { parentTitle: parent.parentTitle } : {})
    }
  }
}
