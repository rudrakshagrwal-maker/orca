// RA: restored cloud-linked metadata cannot trigger token/capability/remote-config refreshes.
import type { RefreshCurrentOrcaProfileAuthResult } from '../../../shared/orca-profiles'
import { getCurrentOrcaProfileAuthStatus } from './profile-cloud-service'

export async function refreshCurrentOrcaProfileAuth(
  userDataPath: string
): Promise<RefreshCurrentOrcaProfileAuthResult> {
  return { status: 'local', auth: getCurrentOrcaProfileAuthStatus(userDataPath) }
}
