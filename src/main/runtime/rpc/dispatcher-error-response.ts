// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import { BranchSwitchLandedWithWarningError } from '../../git/branch-switch'
import { mapBrowserError } from './browser-error-response'
import { ZodError } from 'zod'
import { InvalidArgumentError, formatZodError } from './core'
import type { RpcEnvelopeMeta, RpcRequest, RpcResponse } from './core'
import { computerUseErrorRecoveryData } from '../../../shared/computer-use-error-recovery'
import { errorResponse, mapRuntimeError } from './errors'

export function invalidArgumentResponse(
  request: RpcRequest,
  meta: RpcEnvelopeMeta,
  message: string
): RpcResponse {
  return errorResponse(
    request.id,
    meta,
    'invalid_argument',
    message,
    request.method.startsWith('computer.')
      ? computerUseErrorRecoveryData('invalid_argument')
      : undefined
  )
}

export function mapDispatcherError(
  request: RpcRequest,
  meta: RpcEnvelopeMeta,
  error: unknown
): RpcResponse {
  if (request.method === 'git.checkout' && error instanceof BranchSwitchLandedWithWarningError) {
    return errorResponse(request.id, meta, 'runtime_error', error.message, {
      outcome: 'landed-with-warning'
    })
  }
  if (error instanceof ZodError) {
    return invalidArgumentResponse(request, meta, formatZodError(error))
  }
  if (error instanceof InvalidArgumentError) {
    return invalidArgumentResponse(request, meta, error.message)
  }

  if (request.method.startsWith('browser.')) {
    return mapBrowserError(request.id, meta, error)
  }

  return mapRuntimeError(request.id, meta, error)
}
