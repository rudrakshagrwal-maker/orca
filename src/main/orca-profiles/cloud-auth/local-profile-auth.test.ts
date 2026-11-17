import { expect, it, vi } from 'vitest'
import { getOrcaCloudAuthConfig, isOrcaCloudDevAuthEnabled } from './profile-cloud-auth-config'
import { connectCurrentOrcaProfile, getCurrentOrcaProfileAuthStatus } from './profile-cloud-service'
import { refreshCurrentOrcaProfileAuth } from './profile-cloud-capability-refresh'

vi.mock('../profile-index-store', () => ({
  ensureActiveOrcaProfile: () => ({
    profile: {
      id: 'saved-profile',
      cloud: { userId: 'old-cloud-user', cloudProfileId: 'old-cloud-profile' }
    }
  })
}))

// RA: even a previously linked profile and explicit cloud env overrides remain fully local.
it('loads and refreshes a saved cloud-linked profile as a local account-free profile', async () => {
  const expected = {
    activeProfileId: 'saved-profile',
    configured: false,
    state: 'local',
    persistence: 'none'
  }
  expect(getCurrentOrcaProfileAuthStatus('local-profile')).toEqual(expected)
  await expect(refreshCurrentOrcaProfileAuth('local-profile')).resolves.toEqual({
    status: 'local',
    auth: expected
  })
  await expect(connectCurrentOrcaProfile('local-profile')).resolves.toEqual({
    status: 'unconfigured',
    auth: expected
  })
  const env = {
    ORCA_CLOUD_API_URL: 'https://login.onorca.dev',
    ORCA_CLOUD_CLIENT_ID: 'orca-desktop',
    ORCA_CLOUD_DEV_AUTH: '1'
  }
  expect(getOrcaCloudAuthConfig(env, true).configured).toBe(false)
  expect(isOrcaCloudDevAuthEnabled(env, false)).toBe(false)
})
