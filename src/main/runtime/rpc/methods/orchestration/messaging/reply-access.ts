import type { z } from 'zod'
import type {
  MessageRow,
  QuestionRow,
  RunRow
} from '../../../../orchestration/db/orchestration-records'
import { OrchestrationError } from '../../../../orchestration/orchestration-error'
import { ORCHESTRATION_LEGACY_RUN_ID } from '../../../../../../shared/orchestration/orchestration-rpc-contract'
import type { ReplyParams } from '../../../../../../shared/rpc-contract/orchestration-params'
import {
  assertCallerHandleMatchesEvidence,
  orchestrationCallerIdentity,
  resolveRunScope
} from '../runs/run-scope'
import type { OrchestrationAccessRuleInput } from '../access/orchestration-method-access'
import { helperQuestionAnswerer } from './helper-question-answerer'
import { getRemoteOwnedQuestion } from '../../../../orchestration/db/remote-owned/remote-dispatch-records'

/** Who may answer: the helper a question was asked of, the Run's current consumer, or anyone for plain mail. */
export type ReplyAccess =
  | {
      kind: 'helper'
      original: MessageRow
      question: QuestionRow
      answerer: { dispatchId: string; consumerGeneration: number }
    }
  | { kind: 'run'; original: MessageRow; question: QuestionRow; run: RunRow }
  | { kind: 'message'; original: MessageRow }
  /** A question a worker on a paired server asked; the reply goes to that server. */
  | { kind: 'remote'; original: MessageRow; run: RunRow }

export function replyAccess({
  params,
  ctx,
  caller
}: OrchestrationAccessRuleInput<z.infer<typeof ReplyParams>>): ReplyAccess {
  const { runtime, legacyCoordinatorRunId } = ctx
  const db = runtime.getOrchestrationDb()
  const original = db.getMessageById(params.id)
  if (!original) {
    throw new Error(`Message not found: ${params.id}`)
  }
  if (
    legacyCoordinatorRunId &&
    (original.run_id !== legacyCoordinatorRunId ||
      (params.run !== undefined && params.run !== legacyCoordinatorRunId))
  ) {
    throw new OrchestrationError(
      'request_mismatch',
      `Message ${params.id} does not belong to this adopted Run.`,
      { effectsApplied: false }
    )
  }
  if (
    original.run_id === ORCHESTRATION_LEGACY_RUN_ID ||
    original.delivery_contract === 'legacy_direct' ||
    original.delivery_contract === 'audit_only'
  ) {
    throw new OrchestrationError(
      'legacy_read_only',
      'Legacy orchestration messages are inspect-only; no reply was applied.',
      { effectsApplied: false }
    )
  }
  const question = db.getQuestion(params.id)
  const remote = question ? undefined : getRemoteOwnedQuestion(db, params.id)
  if (remote) {
    // Answered by its Run's coordinator, as a question from a worker here is.
    const run = resolveRunScope(runtime, {
      runId: params.run ?? remote.run_id,
      callerTerminalHandle: caller,
      requireCurrentConsumer: true,
      legacyCoordinatorRunId,
      callerEvidence: ctx.orchestrationCompatibilityEvidence,
      callerSession: ctx.orchestrationCaller
    })
    if (run.id !== remote.run_id) {
      throw new Error(`Message not found: ${params.id}`)
    }
    return { kind: 'remote', original, run }
  }
  if (!question) {
    // RA: session-authenticated callers need no terminal handle to answer their own mail.
    const actor = ctx.orchestrationCaller?.address ?? caller
    if (!actor) {
      throw new OrchestrationError(
        'consumer_fenced',
        'Reply requires the calling coordinator identity.'
      )
    }
    if (!ctx.orchestrationCaller) {
      assertCallerHandleMatchesEvidence(runtime, actor, ctx.orchestrationCompatibilityEvidence)
    }
    const identity = orchestrationCallerIdentity(runtime, {
      handle: actor,
      session: ctx.orchestrationCaller,
      paneKey: ctx.orchestrationCaller ? undefined : runtime.getTerminalPaneKey(actor)
    })
    const own = db.getActiveDispatchForIdentity(identity.address, identity.paneKey ?? undefined)
    // RA: a mirrored worker proves its own Dispatch through the active remote process custody.
    const remote = identity.paneKey
      ? db.findActiveRemoteAttachmentForPane(identity.paneKey)
      : undefined
    const remoteId = remote && identity.terminalHandle &&
      remote.terminal_handle === identity.terminalHandle &&
      db.isRemoteAttachmentProcessCurrent({
        dispatchId: remote.dispatch_id,
        paneKey: identity.paneKey!,
        processIncarnation: runtime.getTerminalProcessIncarnation(identity.terminalHandle)
      }) ? remote.dispatch_id : undefined
    if (original.to_handle.startsWith('run:')) {
      resolveRunScope(runtime, {
        runId: original.run_id,
        callerTerminalHandle: actor,
        callerSession: ctx.orchestrationCaller,
        requireCurrentConsumer: true,
        callerEvidence: ctx.orchestrationCompatibilityEvidence
      })
    } else if (
      original.to_handle !== identity.address &&
      original.to_handle !== `dispatch:${own?.id ?? remoteId}`
    ) {
      throw new OrchestrationError(
        'consumer_fenced',
        'This message belongs to another coordinator. No reply was applied.'
      )
    }
    return { kind: 'message', original }
  }
  const answerer =
    params.run === undefined || params.run === question.run_id
      ? helperQuestionAnswerer(runtime, {
          question: original,
          from: caller,
          session: ctx.orchestrationCaller,
          evidence: ctx.orchestrationCompatibilityEvidence
        })
      : undefined
  if (answerer) {
    return { kind: 'helper', original, question, answerer }
  }
  if (original.to_handle.startsWith('dispatch:')) {
    throw new OrchestrationError(
      'consumer_fenced',
      'This question belongs to another coordinator. No reply was applied.'
    )
  }
  const run = resolveRunScope(runtime, {
    runId: params.run ?? question.run_id,
    callerTerminalHandle: caller,
    requireCurrentConsumer: true,
    legacyCoordinatorRunId,
    callerEvidence: ctx.orchestrationCompatibilityEvidence,
    callerSession: ctx.orchestrationCaller
  })
  return { kind: 'run', original, question, run }
}
