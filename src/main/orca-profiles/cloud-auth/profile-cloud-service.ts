// RA: keep compatibility with saved local profiles without importing any cloud transport or sign-in flow.
import type {
  ConnectCurrentOrcaProfileResult,
  CreateCloudLinkedOrcaProfileArgs,
  CreateCloudLinkedOrcaProfileResult,
  OrcaProfileAuthStatus,
  SelectOrcaProfileOrgResult,
  SignOutCurrentOrcaProfileResult
} from '../../../shared/orca-profiles'
import { ensureActiveOrcaProfile, getOrcaProfileListState } from '../profile-index-store'

export function getCurrentOrcaProfileAuthStatus(userDataPath: string): OrcaProfileAuthStatus {
  return {
    activeProfileId: ensureActiveOrcaProfile(userDataPath).profile.id,
    configured: false,
    state: 'local',
    persistence: 'none'
  }
}

export async function connectCurrentOrcaProfile(
  userDataPath: string
): Promise<ConnectCurrentOrcaProfileResult> {
  return { status: 'unconfigured', auth: getCurrentOrcaProfileAuthStatus(userDataPath) }
}

export async function signOutCurrentOrcaProfile(
  userDataPath: string
): Promise<SignOutCurrentOrcaProfileResult> {
  // RA: no credential revocation or artifact-cloud cleanup on a local-only sign-out.
  const list = getOrcaProfileListState(userDataPath)
  return { status: 'signed-out', auth: getCurrentOrcaProfileAuthStatus(userDataPath), ...list }
}

export async function createCloudLinkedOrcaProfile(
  userDataPath: string,
  _args?: CreateCloudLinkedOrcaProfileArgs
): Promise<CreateCloudLinkedOrcaProfileResult> {
  return { status: 'unconfigured', auth: getCurrentOrcaProfileAuthStatus(userDataPath) }
}

export async function selectCurrentOrcaProfileOrg(
  userDataPath: string,
  _orgId: string
): Promise<SelectOrcaProfileOrgResult> {
  return { status: 'unconfigured', auth: getCurrentOrcaProfileAuthStatus(userDataPath) }
}
