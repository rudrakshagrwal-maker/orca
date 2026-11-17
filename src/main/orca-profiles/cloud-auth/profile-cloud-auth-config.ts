// RA: local-only fork has no cloud endpoints, dev-auth override, or cloud credentials.
export type OrcaCloudAuthConfig = {
  apiBaseUrl: string
  authorizeEndpoint: string
  sessionEndpoint: string
  refreshEndpoint: string
  capabilitiesEndpoint: string
  profileEndpoint: string
  orgEndpoint: string
  logoutEndpoint: string
  relayTokenEndpoint: string
  connectorTokenEndpoint: string
  relayDirectorUrl: string
  clientId: string
  scope: string
}

export function getOrcaCloudAuthConfig(
  _env: NodeJS.ProcessEnv = process.env,
  _packaged = false
): { configured: true; config: OrcaCloudAuthConfig } | { configured: false; setupMessage: string } {
  return { configured: false, setupMessage: 'Orca runs locally without an account.' }
}

export function allowsPlaintextOrcaCloudSession(
  _env: NodeJS.ProcessEnv = process.env,
  _packaged = false
): boolean {
  return false
}

export function isOrcaCloudDevAuthEnabled(
  _env: NodeJS.ProcessEnv = process.env,
  _packaged = false
): boolean {
  return false
}
