// RA: Remove unused surfaces and their startup dependencies from the lean fork.
// Emit future turn completions and opted-in prompts only; unlike status snapshots, missed edges never replay.

import { defineStreamingMethod } from '../../../core'
import { requireStructuredHost as requireHost } from '../creation/structured-agent-session-gate'
import { SubscribeTurnCompletionsParams } from '../../../../../../shared/rpc-contract/structured-agent-session-params'
import '../../../../../../shared/rpc-contract/structured-agent-session-continue-params'
import '../../../../../../shared/rpc-contract/structured-agent-session-rename-params'
import '../../../../../../shared/rpc-contract/structured-agent-session-queued-edit-params'
import { structuredAgentSessionTurnCompletionSubscriptionId } from './structured-agent-session-subscription-id'
import { bindStructuredAgentSessionStream } from './structured-agent-session-status-stream'
import { clientReadsStructuredSessionAgent } from '../structured-agent-session-policy'

export const STRUCTURED_AGENT_SESSION_TURN_COMPLETION_METHODS = [
  // Retire delivered attention covered by the journal boundary without installing the host.

  defineStreamingMethod({
    name: 'agentSession.subscribeTurnCompletions',
    permission: 'workspace',
    params: SubscribeTurnCompletionsParams,
    handler: async (params, ctx, emit) => {
      const host = requireHost(ctx)
      const subscriptionId = structuredAgentSessionTurnCompletionSubscriptionId(ctx)
      let dispose = (): void => {}
      const stream = bindStructuredAgentSessionStream(ctx, subscriptionId, () => dispose())
      if (stream.isClosed()) {
        return
      }
      dispose = host.subscribeTurnCompletions({
        id: subscriptionId,
        // A client that cannot read an agent's rows is not told that agent's edges either.
        emit: (event) => {
          const sessionId =
            event.type === 'completion'
              ? event.completion.sessionId
              : event.type === 'prompt'
                ? event.prompt.sessionId
                : undefined
          if (
            sessionId === undefined ||
            clientReadsStructuredSessionAgent(ctx, host.sessionAgent(sessionId) ?? '')
          ) {
            emit(event)
          }
        },
        includePrompts: params.includePrompts === true
      })
      if (stream.isClosed()) {
        dispose()
      }
    }
  })
]
