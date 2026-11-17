import type { z } from 'zod'
import { defineMethod } from '../../core'
import {
  ORCAD_TERMINAL_CENSUS_METHOD,
  OrcadTerminalCensusParamsSchema,
  type OrcadTerminalCensus
} from '../../../../../shared/orcad-terminal-census'

const SPAWN_SETTLE_MS = 10_000
const UNVERIFIABLE: OrcadTerminalCensus = {
  liveSessions: null,
  startedSinceActivation: null,
  daemonProtocolVersion: null
}

export const ORCAD_TERMINAL_CENSUS_METHODS = [
  defineMethod({
    name: ORCAD_TERMINAL_CENSUS_METHOD,
    permission: 'host-admin',
    params: OrcadTerminalCensusParamsSchema,
    handler: async (params, { runtime }) => {
      if (params.closeAdmissionForMs === undefined) {
        return countTerminals(params)
      }
      // Before counting: a terminal admitted after the count would die with the stop, uncounted.
      const admission = runtime.terminalUpdateAdmission
      const admissionClosedUntil = admission.close(params.closeAdmissionForMs)
      // A spawn admitted before the close may still be starting; count only once it has.
      if (admissionClosedUntil > 0 && !(await admission.waitForSpawnsToSettle(SPAWN_SETTLE_MS))) {
        return { ...UNVERIFIABLE, admissionClosedUntil }
      }
      return { ...(await countTerminals(params)), admissionClosedUntil }
    }
  })
]

// RA: no automation runtime is needed to count terminals or fence updates.
async function countTerminals(
  params: z.infer<typeof OrcadTerminalCensusParamsSchema>
): Promise<OrcadTerminalCensus> {
  const { collectOrcadTerminalCensus } = await import('../../../../orcad/orcad-terminal-census')
  return collectOrcadTerminalCensus(params.activatedAt)
}
