// RA: keep the shared fixture shape and Codex coverage after removing other integrations.
import type { AiVaultAgent } from '../../shared/ai-vault/contracts/ai-vault-types'
import { codexFixture } from './scanners/codex/session-scanner-codex-fixtures'
export type IncrementalAgentFixture = {
  agent: AiVaultAgent
  fileName: string
  seedLines: string[]
  appendLines: string[]
  truncatedLines: string[]
}
export function allIncrementalAgentFixtures(): IncrementalAgentFixture[] {
  return [codexFixture()]
}
