import { Suspense, type ReactNode } from 'react'
import { useAppStore } from '@/store'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { lazyWithRetry } from '@/app-shell/startup/lazy-with-retry'
import { useTranslate } from '@/i18n/use-translate'
import { SidebarFilesSection } from './SidebarFilesSection'

const SessionSearchPanel = lazyWithRetry(() => import('../session-search/SessionSearchPanel'))

export function SidebarViews({ children }: { children: ReactNode }): React.JSX.Element {
  const view = useAppStore((s) => s.sidebarView)
  const setView = useAppStore((s) => s.setSidebarView)
  const t = useTranslate()
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-2 py-2">
        <div className="rounded-md bg-muted p-0.5">
          <ToggleGroup
            variant="segmented"
            size="xs"
            type="single"
            spacing={1}
            value={view}
            onValueChange={(value) => {
              if (value === 'projects' || value === 'files' || value === 'search') {
                setView(value)
              }
            }}
            aria-label={t('sidebar.view', 'Sidebar view')}
            className="h-6 w-full"
          >
            <ToggleGroupItem value="projects" className="min-w-0 flex-1">
              {t('dashboard.sidebar.projects', 'Projects')}
            </ToggleGroupItem>
            <ToggleGroupItem value="files" className="min-w-0 flex-1">
              {t('sidebar.files', 'Files')}
            </ToggleGroupItem>
            <ToggleGroupItem value="search" className="min-w-0 flex-1">
              {t('sidebar.search', 'Search')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      {view === 'projects' ? children : null}
      {view === 'files' ? <SidebarFilesSection /> : null}
      {view === 'search' ? (
        <Suspense fallback={null}>
          <SessionSearchPanel />
        </Suspense>
      ) : null}
    </div>
  )
}
