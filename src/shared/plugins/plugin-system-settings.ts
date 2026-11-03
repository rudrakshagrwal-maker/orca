import { backgroundJobsDisabled } from '../fork-background-policy'
/** The plugin system's switches, approvals and dev paths, composed into GlobalSettings. */
export type PluginSystemSettings = {
  /** Master switch for the plugin system. RA: off by default; false means no
   *  discovery, no panels, no plugin code paths run at all. */
  pluginSystemEnabled: boolean
  /** RA: Retain the legacy rollout guard so settings writers and older stores
   *  preserve explicit plugin choices. */
  pluginSystemDefaultedOn?: boolean
  /** Qualified plugin keys (`publisher.id`) the user disabled. Discovered
   *  plugins stay listed but are not activated. */
  disabledPlugins: string[]
  /** Consent records: qualified plugin key → capability/worker-trust fingerprint.
   *  A plugin whose current fingerprint differs is pending again, so an update
   *  crossing either trust boundary re-prompts before code runs. Absent key =
   *  never consented. */
  pluginConsents: Record<string, string>
  /** Local directories loaded as dev-mode plugins (manifest hot-reload). */
  devPluginPaths: string[]
  /** Built-in action ids the person keeps for Orca: no plugin command runs in their place. */
  pluginReplacementsOff?: string[]
  /** Qualified plugin key → hosts the person always allows its frames to open. Main-only. */
  pluginExternalHostGrants?: Record<string, string[]>
}

type PluginSystemDefaultOnSettings = Pick<
  PluginSystemSettings,
  'pluginSystemEnabled' | 'pluginSystemDefaultedOn'
>

export function normalizePluginSystemEnabledDefaultOn(
  settings: Partial<PluginSystemDefaultOnSettings> | undefined
): Required<PluginSystemDefaultOnSettings> {
  // RA: preserve agent configuration across every direct entry point.
  if (backgroundJobsDisabled()) {
    return { pluginSystemEnabled: false, pluginSystemDefaultedOn: true }
  }
  return {
    // RA: Missing or legacy settings must not enable marketplace fetches on startup.
    pluginSystemEnabled: settings?.pluginSystemEnabled === true,
    pluginSystemDefaultedOn: true
  }
}

/** Whether `plugin:<key>/<name>` content comes from a plugin that is switched off. */
export function isPluginContentSwitchedOff(
  settings:
    | Partial<Pick<PluginSystemSettings, 'pluginSystemEnabled' | 'disabledPlugins'>>
    | undefined,
  contentId: string
): boolean {
  if (!contentId.startsWith('plugin:')) {
    return false
  }
  const pluginKey = contentId.slice('plugin:'.length, contentId.lastIndexOf('/'))
  return (
    settings?.pluginSystemEnabled === false ||
    (Array.isArray(settings?.disabledPlugins) && settings.disabledPlugins.includes(pluginKey))
  )
}
