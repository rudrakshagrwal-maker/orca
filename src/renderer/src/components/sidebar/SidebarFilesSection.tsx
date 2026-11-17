import { Suspense } from 'react'
import { ChevronRight } from 'lucide-react'
import { lazyWithRetry } from '@/app-shell/startup/lazy-with-retry'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { useAppStore } from '@/store'
import { SIDEBAR_FILES_COLLAPSED_KEY } from '../../../../shared/sidebar-agent-disclosure'

const FileExplorer = lazyWithRetry(() => import('../right-sidebar/file-explorer/panel/FileExplorer'))

export function SidebarFilesSection(): React.JSX.Element {
  const t = useTranslate()
  const open = useAppStore((s) => !s.collapsedGroups.has(SIDEBAR_FILES_COLLAPSED_KEY))
  const toggleCollapsedGroup = useAppStore((s) => s.toggleCollapsedGroup)

  return (
    <Collapsible
      open={open}
      onOpenChange={() => toggleCollapsedGroup(SIDEBAR_FILES_COLLAPSED_KEY)}
      onDragEnter={(event) => event.stopPropagation()}
      onDragLeave={(event) => event.stopPropagation()}
      className={cn('flex min-h-0 flex-col border-t border-border', open ? 'flex-1' : 'shrink-0')}
    >
      <CollapsibleTrigger className="flex h-8 shrink-0 items-center gap-1.5 px-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRight className={cn('size-4', open && 'rotate-90')} />
        {t('sidebar.files', 'Files')}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {open ? (
          <Suspense fallback={null}>
            <FileExplorer />
          </Suspense>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
