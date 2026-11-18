import type { CommandHandler } from '../../dispatch'
import { parseCliAgent } from '../../agent-launch-request'
import { printResult } from '../../format'
import { withReceiptNext } from './receipt-next-text'
import { getOptionalStringFlag, getPresentStringFlag } from '../../flags'
import { RuntimeClientError, type RuntimeClient } from '../../runtime-client'
import type { RuntimeStatus } from '../../../shared/runtime-types'
import { ORCHESTRATION_WORKER_LAUNCH_PREFERENCES_RUNTIME_CAPABILITY } from '../../../shared/orchestration/orchestration-runtime-capabilities'
import { callOrchestrationMutation } from './mutation-request'
import { getOptionalPositiveIntegerValueFlag } from './numeric-flags'
import { isDevCliInvocation } from './runtime-compatibility'
import { resolveCoordinatorTerminalHandle } from './terminal-identity'
import { formatWorkerStart, type WorkerReleaseReceipt } from './worker-output'
import { isUnobservedTurnStart, WORKER_START_VIEW } from './worker-start-agent-view'
import {
  printOrchestrationResult,
  renderOrchestrationArgv,
  reportOrchestrationFailure
} from './agent-view'
import { explainOlderRuntimeRunRequired } from './older-runtime-run-binding'
import { withResolvedNextCommands } from '../../orchestration-mutation-recovery'
import { readTextOrFileFlag } from '../../command-body-input'
import { refuseAgentServerRoute } from './agent-server-route'
import { printWorkerResult, workerResultTimeout } from './worker-result-wait'

export const ORCHESTRATION_WORKER_LAUNCH_HANDLER: Record<string, CommandHandler> = {
  'orchestration worker-start': async (ctx) => {
    const { flags, client, cwd, json } = ctx
    const wait = flags.has('wait')
    const timeoutMs = workerResultTimeout(flags)
    if (
      flags.has('brief-file') &&
      (flags.has('spec') || flags.has('spec-file') || flags.has('task'))
    ) {
      throw new RuntimeClientError(
        'invalid_argument',
        'Use --brief-file alone, or --task / --spec / --spec-file.'
      )
    }
    const inputFlags = new Map(flags)
    if (flags.has('brief-file')) {
      inputFlags.set('spec-file', flags.get('brief-file')!)
    }
    const spec = await readTextOrFileFlag(inputFlags, cwd, 'spec', false)
    const requestedAgent = getOptionalStringFlag(flags, 'agent')
    const agent = requestedAgent === undefined ? undefined : parseCliAgent(requestedAgent)
    await refuseAgentServerRoute('worker-start', ctx)
    const terminal = getPresentStringFlag(flags, 'terminal')
    const model = getOptionalStringFlag(flags, 'model')
    const effort = getOptionalStringFlag(flags, 'effort')
    if (model || effort) {
      const status = await client.call<RuntimeStatus>('status.get')
      if (
        !status.result.capabilities?.includes(
          ORCHESTRATION_WORKER_LAUNCH_PREFERENCES_RUNTIME_CAPABILITY
        )
      ) {
        throw new RuntimeClientError(
          'incompatible_runtime',
          'The connected Orca runtime does not support worker model or effort overrides. Update or restart Orca and try again.'
        )
      }
    }
    const task = getOptionalStringFlag(flags, 'task')
    const taskTitle = getOptionalStringFlag(flags, 'task-title')
    const deps = getOptionalStringFlag(flags, 'deps')
    const parent = getOptionalStringFlag(flags, 'parent')
    const result = await callOrchestrationMutation<{
      runId: string
      taskId: string
      dispatchId: string
      state: string
      failedStage?: string
      lastError?: string
      warning?: string
      mode?: { mode: string; preferred: string; reason: string; detail: string }
      effects: unknown[]
      residualResources: unknown[]
      nextCommands?: string[]
      next?: string
    }>(client, flags, 'orchestration.workerStart', {
      // RA: record the actual calling shell, separately from explicit --from authority.
      ...(process.env.ORCA_TERMINAL_HANDLE
        ? { parentTerminalHandle: process.env.ORCA_TERMINAL_HANDLE }
        : {}),
      task,
      ...(spec ? { spec } : {}),
      ...(taskTitle ? { taskTitle } : {}),
      ...(deps ? { deps } : {}),
      ...(parent ? { parent } : {}),
      on: getOptionalStringFlag(flags, 'on'),
      worktree: getOptionalStringFlag(flags, 'worktree'),
      name: getOptionalStringFlag(flags, 'name'),
      repo: getOptionalStringFlag(flags, 'repo'),
      baseBranch: getOptionalStringFlag(flags, 'base-branch'),
      displayName: getOptionalStringFlag(flags, 'display-name'),
      comment: getOptionalStringFlag(flags, 'comment'),
      setup: getOptionalStringFlag(flags, 'setup'),
      agent,
      model,
      effort,
      terminal,
      retryOf: getOptionalStringFlag(flags, 'retry-of'),
      timeoutMs: getOptionalPositiveIntegerValueFlag(flags, 'timeout-ms'),
      run: getOptionalStringFlag(flags, 'run'),
      from: await resolveCoordinatorTerminalHandle(flags, cwd, client),
      devMode: isDevCliInvocation()
    }).catch(async (error: unknown) => {
      throw await explainOlderRuntimeRunRequired(client, error)
    })
    if (
      result.result.state !== 'ready' &&
      result.result.state !== 'queued' &&
      !(wait && isUnobservedTurnStart(result.result))
    ) {
      // RA: admission is accepted, not failed.
      process.exitCode = 1
    }
    const keepOpenState =
      (flags.has('keep-open') || startsInNewWorkspace(flags)) &&
      (result.result.state === 'ready' ||
        result.result.state === 'queued' ||
        isUnobservedTurnStart(result.result)) // RA: queued work keeps its requested custody.
        ? await keepWorkerOpen(client, result.result.dispatchId)
        : undefined
    // Only an explicit --keep-open fails the start; a new workspace's default is best effort.
    if (flags.has('keep-open') && keepOpenState && keepOpenState !== 'retained') {
      const dispatchId = result.result.dispatchId
      // The worker runs either way, so the next step never starts it again.
      const verb =
        keepOpenState === 'already_released'
          ? 'worker-read'
          : keepOpenState.startsWith('release_') || keepOpenState === 'no_owned_resource'
            ? 'worker-show'
            : 'worker-keep-open'
      reportOrchestrationFailure({
        code: 'not_kept_open',
        message: `${dispatchId} started but was not kept open (${keepOpenState}). Run ${renderOrchestrationArgv(['orchestration', verb, '--dispatch', dispatchId])}.`
      })
    }
    const renderedResult = {
      ...result,
      result: {
        ...withResolvedNextCommands(result.result),
        ...(keepOpenState === 'retained' ? { keptOpen: true as const } : {})
      }
    }
    if (
      wait &&
      (result.result.state === 'ready' ||
        result.result.state === 'queued' ||
        isUnobservedTurnStart(result.result))
    ) {
      try {
        await printWorkerResult(client, result.result.dispatchId, timeoutMs, json)
      } catch (error) {
        throw new RuntimeClientError(
          'worker_wait_failed',
          `Worker ${result.result.dispatchId} started; waiting failed: ${error instanceof Error ? error.message : String(error)}. Resume with worker-show --dispatch ${result.result.dispatchId} --wait.`,
          {
            runId: result.result.runId,
            taskId: result.result.taskId,
            dispatchId: result.result.dispatchId
          }
        )
      }
      return
    }
    if (flags.has('full')) {
      printResult(renderedResult, json, (value) =>
        withReceiptNext(
          `${formatWorkerStart(value)}${value.keptOpen ? '\nKept open after it finishes' : ''}`,
          value
        )
      )
    } else {
      printOrchestrationResult(renderedResult, json, WORKER_START_VIEW)
    }
  }
}

// A worker given its own new workspace is that workspace's chat; closing it frees no space.
function startsInNewWorkspace(flags: Map<string, string | boolean>): boolean {
  const worktree = getOptionalStringFlag(flags, 'worktree')
  return worktree === 'new-child' || worktree === 'new-top-level'
}

// Every host version serves workerRetain, so older servers keep the worker open too.
async function keepWorkerOpen(client: RuntimeClient, dispatch: string): Promise<string> {
  try {
    const { result } = await client.call<WorkerReleaseReceipt>('orchestration.workerRetain', {
      dispatch
    })
    // A retained receipt without an owned terminal kept nothing open.
    return result.reason === 'no_owned_resource' ? result.reason : result.state
  } catch (error) {
    return error instanceof RuntimeClientError ? error.code : 'keep_open_failed'
  }
}
