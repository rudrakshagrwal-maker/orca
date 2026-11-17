import { useEffect, useState } from 'react'
import { BROWSER_USE_ENABLED_STORAGE_KEY } from '@/lib/browser/browser-use-setup-state'
import { useAppStore } from '../../../../store/index'
import '../../../../../../shared/constants'
import { BROWSER_FAMILY_LABELS } from '../../../../../../shared/browser/browser-family-labels'
import { matchesSettingsSearch } from '../../search/settings-search'
import { getBrowserUsePaneSearchEntries } from './browser-use-search'
import { BrowserUseExamples } from './BrowserUseExamples'
import { BrowserUseEnableSwitch } from './BrowserUseEnableSwitch'
import { BrowserUseCookieImportStep } from './BrowserUseCookieImportStep'
import { useTranslate } from '@/i18n/use-translate'

type BrowserUseSetupProps = {
  onConfigureMoreBrowsers?: () => void
  onOpenComputerUse?: () => void
}

export function BrowserUseSetup({
  onConfigureMoreBrowsers
}: BrowserUseSetupProps = {}): React.JSX.Element {
  const t = useTranslate()
  const searchQuery = useAppStore((s) => s.settingsSearchQuery)
  const browserSessionProfiles = useAppStore((s) => s.browserSessionProfiles)
  const fetchBrowserSessionProfiles = useAppStore((s) => s.fetchBrowserSessionProfiles)
  const browserSessionImportState = useAppStore((s) => s.browserSessionImportState)

  const [browserUseEnabled, setBrowserUseEnabled] = useState<boolean>(() => {
    return localStorage.getItem(BROWSER_USE_ENABLED_STORAGE_KEY) === '1'
  })

  const toggleBrowserUse = (value: boolean): void => {
    setBrowserUseEnabled(value)
    localStorage.setItem(BROWSER_USE_ENABLED_STORAGE_KEY, value ? '1' : '0')
    if (value) {
      useAppStore.getState().recordFeatureInteraction('agent-browser-setup')
    }
  }

  useEffect(() => {
    if (!browserUseEnabled) {
      return
    }
    void fetchBrowserSessionProfiles()
  }, [browserUseEnabled, fetchBrowserSessionProfiles])

  const defaultProfile = browserSessionProfiles.find((p) => p.id === 'default')
  const cookiesImported = !!defaultProfile?.source

  const isImportingDefault =
    browserSessionImportState?.profileId === 'default' &&
    browserSessionImportState.status === 'importing'

  const showCookieImportStep = matchesSettingsSearch(searchQuery, [
    getBrowserUsePaneSearchEntries()[1]
  ])
  const steps = [cookiesImported]
  const completedCount = steps.filter(Boolean).length

  const sourceLabel = defaultProfile?.source
    ? `${BROWSER_FAMILY_LABELS[defaultProfile.source.browserFamily] ?? defaultProfile.source.browserFamily}${defaultProfile.source.profileName ? ` (${defaultProfile.source.profileName})` : ''}`
    : null

  if (!browserUseEnabled) {
    return (
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {t('auto.components.settings.BrowserUsePane.507fdae102', 'Agent browser use')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(
              'auto.components.settings.BrowserUsePane.96b91c6349',
              'Let coding agents drive this browser with your logins.'
            )}
          </p>
        </div>
        <BrowserUseEnableSwitch
          enabled={browserUseEnabled}
          onToggle={() => toggleBrowserUse(!browserUseEnabled)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">
            {t('auto.components.settings.BrowserUsePane.507fdae102', 'Agent browser use')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(
              'auto.components.settings.BrowserUsePane.finishSteps',
              'Let coding agents drive this browser with your logins. Finish the steps below.'
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              completedCount === steps.length
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {completedCount}/{steps.length}
          </span>
          <BrowserUseEnableSwitch
            enabled={browserUseEnabled}
            onToggle={() => toggleBrowserUse(!browserUseEnabled)}
          />
        </div>
      </div>

      {showCookieImportStep ? (
        <BrowserUseCookieImportStep
          cookiesImported={cookiesImported}
          isImportingDefault={isImportingDefault}
          sourceLabel={sourceLabel}
          onConfigureMoreBrowsers={onConfigureMoreBrowsers}
        />
      ) : null}

      <BrowserUseExamples />
    </div>
  )
}
