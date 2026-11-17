import { join } from 'node:path'
import { homedir } from 'node:os'
import { prepareOrcadSecretStore } from './orcad-host-adapters'

// RA: keep host encryption ready without visiting removed integrations' credential stores.
export async function prepareOrcadSecretStoreAndMigrate(userDataPath: string): Promise<void> {
  const { reportSecretProtectionGap } = await import('../host/secret-protection-report')
  await prepareOrcadSecretStore(join(homedir(), '.orca'), userDataPath)
  reportSecretProtectionGap({ dataFile: join(userDataPath, 'orca-data.json') })
}
