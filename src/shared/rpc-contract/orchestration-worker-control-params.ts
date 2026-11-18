import { z } from 'zod'
import { OptionalFiniteNumber, requiredString } from './rpc-param-primitives'
import { ORCHESTRATION_WORKER_READ_SOURCES } from '../orchestration/workers/orchestration-worker-output'
import { MAX_TIMER_DELAY_MS } from '../timer-delay'

export const WorkerDispatchParams = z.object({ dispatch: requiredString('Missing --dispatch') })

export const WorkerShowParams = WorkerDispatchParams.extend({
  wait: z.boolean().optional(),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .max(MAX_TIMER_DELAY_MS - 10_000)
    .optional()
})

export const WorkerReadParams = WorkerDispatchParams.extend({
  cursor: z.union([z.number().int().nonnegative(), z.string().min(1).max(2_048)]).optional(),
  limit: OptionalFiniteNumber,
  source: z.enum(ORCHESTRATION_WORKER_READ_SOURCES).optional()
})
