// RA: Remove unused surfaces and their startup dependencies from the lean fork.

import { resolve } from 'node:path'
import type { CommandHandler } from '../dispatch'
import { formatCliStatus, formatStatus, printResult } from '../format'
import { RuntimeClientError, serveOrcaApp } from '../runtime-client'
import { getOptionalServeBind } from '../runtime/serve-bind-flag'

import { resolveCliStatusCaller } from '../runtime/status-caller'
import { getServeSuperviseValidationError } from '../runtime/serve-supervised-service'
import { getOptionalServePort } from '../runtime/serve-port-flag'
import { resolveLaunchUserDataPath } from '../runtime/launch-user-data-path'
import { getServeOptionValidationError } from '../../shared/serve-option-validation'

export const CORE_HANDLERS: Record<string, CommandHandler> = {
  open: async ({ client, json }) => {
    const result = await client.openOrca()
    printResult(result, json, formatCliStatus)
  },
  serve: async ({ flags, json }) => {
    if (flags.get('reclaim-stale-lock') === true) {
      const dataRoot = flags.get('data-root')
      // Why refuse rather than default: a missing value would point a destructive command elsewhere.
      if (flags.has('data-root') && (typeof dataRoot !== 'string' || !dataRoot.trim())) {
        throw new RuntimeClientError(
          'invalid_argument',
          '--data-root expects a directory. Usage: orca serve --reclaim-stale-lock [--data-root <dir>] [--yes] [--json]'
        )
      }
      // Why lazy: only this mode needs orcad's lock code, and every other command skips loading it.
      const { printOrcadStaleLockReclaimResult, reclaimStaleOrcadInstanceLock } =
        await import('../../main/orcad/orcad-stale-lock-reclaim.js')
      const result = await reclaimStaleOrcadInstanceLock(
        typeof dataRoot === 'string' ? resolve(dataRoot) : resolveLaunchUserDataPath(),
        // This CLI's own binary is no command to give a user; `orca serve` is.
        { yes: flags.get('yes') === true, hintRuntime: null }
      )
      printOrcadStaleLockReclaimResult(result, json)
      process.exitCode = result.exitCode
      return
    }
    const projectRootValue = flags.get('project-root')
    const projectRoot = typeof projectRootValue === 'string' ? projectRootValue : null
    const noPairing = flags.get('no-pairing') === true
    const allowPublic = flags.get('allow-public') === true
    const refusePublic = flags.get('refuse-public') === true
    const recipeJson = flags.get('recipe-json') === true
    const force = flags.get('force') === true
    const supervise = flags.get('supervise') === true
    const superviseError = getServeSuperviseValidationError({ supervise, recipeJson })
    if (superviseError) {
      throw new RuntimeClientError('invalid_argument', superviseError)
    }
    const bind = getOptionalServeBind(flags) ?? null
    const validationError = getServeOptionValidationError({
      bind,
      noPairing,
      mobilePairing: false,
      allowPublic,
      refusePublic,
      recipeJson,
      projectRoot
    })
    if (validationError) {
      throw new RuntimeClientError('invalid_argument', validationError)
    }
    const port = getOptionalServePort(flags)
    const pairingAddressValue = flags.get('pairing-address')
    const exitCode = await serveOrcaApp({
      json,
      port,
      bind,
      pairingAddress: typeof pairingAddressValue === 'string' ? pairingAddressValue : null,
      noPairing,
      recipeJson,
      projectRoot,
      ...(allowPublic ? { allowPublic: true } : {}),
      ...(refusePublic ? { refusePublic: true } : {}),
      ...(force ? { force: true } : {}),
      ...(supervise ? { supervise: true } : {})
    })
    process.exitCode = exitCode
  },
  status: async ({ client, json }) => {
    const result = await client.getCliStatus()
    if (!json && !result.result.runtime.reachable) {
      process.exitCode = 1
    }
    const caller = result.result.runtime.reachable
      ? await resolveCliStatusCaller(client)
      : undefined
    printResult(
      caller === undefined ? result : { ...result, result: { ...result.result, caller } },
      json,
      formatStatus
    )
  }
}
