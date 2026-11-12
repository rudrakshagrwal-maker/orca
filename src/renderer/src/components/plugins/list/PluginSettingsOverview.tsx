import { Puzzle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PluginHostListEntry } from '../../../../../preload/api-types'
import { useTranslate } from '@/i18n/use-translate'
import { PluginManager } from './PluginManager'
import type { InstalledRowHandlers } from './PluginManagerRows'
import type { PluginLogsState } from '../state/use-plugin-logs'
import type { PluginPageNavigation } from '../state/use-plugin-page-navigation'

type PluginSettingsOverviewProps = {
  featureEnabled: boolean
  onEnable?: () => void // RA: the fork keeps plugins off until explicit opt-in.
  settingsError: string | null
  loading: boolean
  error: string | null
  plugins: PluginHostListEntry[]
  busyPluginKeys: ReadonlySet<string>
  /** Records a review decision made on the plugin's page. */
  onConsent: (
    pluginKey: string,
    reviewedFingerprint: string,
    decision: 'approve' | 'keep-disabled'
  ) => Promise<void>
  handlers: Omit<InstalledRowHandlers, 'onOpen' | 'onViewLogs' | 'onCheckUpdate'>
  onRefresh: () => Promise<void>
  onMarketplaceInstalled: (pluginKeys: string | readonly string[]) => Promise<void>
  logsByPlugin: Readonly<Record<string, PluginLogsState>>
  onShowLogs: (pluginKey: string) => void
  onOpenShortcuts: () => void
  sourcesOpen: boolean
  setSourcesOpen: (open: boolean) => void
  page: PluginPageNavigation
}

/** RA: the fork starts off and preserves a deliberate saved opt-in. */
function PluginsOffState({ onEnable }: { onEnable?: () => void }): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/40 py-2.5 pr-3 pl-4">
      <Puzzle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm font-medium">
        {t('auto.components.settings.PluginSettingsOverview.offTitle', 'Plugins are off')}
      </p>
      {onEnable ? (
        <Button size="sm" onClick={onEnable}>
          {t('plugins.enable', 'Enable plugins')}
        </Button>
      ) : null}
    </div>
  )
}

export function PluginSettingsOverview({
  featureEnabled,
  onEnable,
  settingsError,
  loading,
  error,
  plugins,
  busyPluginKeys,
  onConsent,
  handlers,
  onRefresh,
  onMarketplaceInstalled,
  logsByPlugin,
  onShowLogs,
  onOpenShortcuts,
  sourcesOpen,
  setSourcesOpen,
  page
}: PluginSettingsOverviewProps): React.JSX.Element {
  return (
    <>
      {featureEnabled ? null : <PluginsOffState onEnable={onEnable} />}
      {settingsError ? <p className="text-xs text-destructive">{settingsError}</p> : null}
      {featureEnabled ? (
        <PluginManager
          plugins={plugins}
          pluginsLoading={loading}
          pluginsError={error}
          busyPluginKeys={busyPluginKeys}
          onConsent={onConsent}
          handlers={handlers}
          onRefreshInstalled={onRefresh}
          onInstalled={onMarketplaceInstalled}
          logsByPlugin={logsByPlugin}
          onShowLogs={onShowLogs}
          onOpenShortcuts={onOpenShortcuts}
          page={page}
          sourcesOpen={sourcesOpen}
          setSourcesOpen={setSourcesOpen}
        />
      ) : null}
    </>
  )
}
