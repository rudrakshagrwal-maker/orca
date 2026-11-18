import { RuntimeClientError, type RuntimeClient } from '../../runtime-client'
import { printResult } from '../../format'
import { MAX_TIMER_DELAY_MS } from '../../../shared/timer-delay'
import { getOptionalPositiveIntegerValueFlag } from './numeric-flags'
import { startCheckKeepalive } from './check-keepalive'

export function workerResultTimeout(flags: Map<string, string | boolean>): number {
  const seconds = getOptionalPositiveIntegerValueFlag(flags, 'timeout')
  if (
    seconds !== undefined &&
    (!flags.has('wait') || seconds * 1_000 > MAX_TIMER_DELAY_MS - 10_000)
  ) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--timeout requires --wait and must fit within the timer limit.'
    )
  }
  return (seconds ?? 1_800) * 1_000
}

export async function printWorkerResult(
  client: RuntimeClient,
  dispatch: string,
  timeoutMs: number,
  json: boolean
): Promise<void> {
  const stop = startCheckKeepalive(timeoutMs)
  try {
    const result = await client.call<{
      dispatchId: string
      state: string
      outcome: string | null
      result: string | null
      timedOut: boolean
      cancelled: boolean
    }>(
      'orchestration.workerShow',
      { dispatch, wait: true, timeoutMs },
      { timeoutMs: timeoutMs + 10_000 }
    )
    if (typeof result.result.timedOut !== 'boolean') {
      throw new RuntimeClientError(
        'incompatible_runtime',
        'This runtime cannot wait for a worker result. Update Orca.'
      )
    }
    if (
      result.result.outcome !== 'succeeded' ||
      result.result.cancelled ||
      result.result.timedOut
    ) {
      process.exitCode = 1
    }
    printResult(
      result,
      json,
      (value) =>
        `${value.dispatchId} [${value.timedOut ? 'timed_out' : value.state}]\n${value.result ?? ''}`
    )
  } finally {
    stop()
  }
}
