import type { GlobalSettings } from '../../shared/global-settings-types'
import { HermesPeersSchema } from '../../shared/hermes-peers'

type LegacyTerminalScrollbackSettingsUpdate = Partial<GlobalSettings> & {
  terminalScrollbackBytes?: unknown
}

export function sanitizeRendererSettingsUpdate(
  args: Partial<GlobalSettings>
): Partial<GlobalSettings> {
  const {
    terminalScrollbackBytes: _legacyScrollbackBytes,
    ...sanitizedArgs
  }: LegacyTerminalScrollbackSettingsUpdate = args
  void _legacyScrollbackBytes
  if ('hermesPeers' in sanitizedArgs) {
    sanitizedArgs.hermesPeers = HermesPeersSchema.parse(sanitizedArgs.hermesPeers)
  }
  // Plugin consent and enablement require main's reviewed-fingerprint handlers.
  // Account configuration must stop old writers and commit through the host account operation.
  delete sanitizedArgs.antigravityChatAuth
  delete sanitizedArgs.pluginConsents
  delete sanitizedArgs.disabledPlugins
  delete sanitizedArgs.pluginExternalHostGrants
  if (
    'browserPasswordsFillRequiresReauth' in sanitizedArgs &&
    typeof sanitizedArgs.browserPasswordsFillRequiresReauth !== 'boolean'
  ) {
    delete sanitizedArgs.browserPasswordsFillRequiresReauth
  }
  return sanitizedArgs
}
