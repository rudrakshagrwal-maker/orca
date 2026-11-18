import { Suspense } from 'react'
import { ChevronRight } from 'lucide-react'
import { lazyWithRetry } from '@/app-shell/startup/lazy-with-retry'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { useAppStore } from '@/store'
import { SIDEBAR_FILES_COLLAPSED_KEY } from '../../../../shared/sidebar-agent-disclosure'
import { useSidebarSectionResize } from './use-sidebar-agent-section-resize'

const FileExplorer = lazyWithRetry(
  () => import('../right-sidebar/file-explorer/panel/FileExplorer')
)

export function SidebarFilesSection(): React.JSX.Element {
  const t = useTranslate()
  const open = useAppStore((s) => !s.collapsedGroups.has(SIDEBAR_FILES_COLLAPSED_KEY))
  const toggleCollapsedGroup = useAppStore((s) => s.toggleCollapsedGroup)
  const height = useAppStore((s) => s.sidebarFilesHeight)
  const setHeight = useAppStore((s) => s.setSidebarFilesHeight)
  const resize = useSidebarSectionResize({
    height,
    setHeight,
    minHeight: 120,
    reservedHeight: 120,
    defaultFraction: 0.45,
    enabled: open
  })

  return (
    <Collapsible
      ref={resize.sectionRef}
      open={open}
      onOpenChange={() => toggleCollapsedGroup(SIDEBAR_FILES_COLLAPSED_KEY)}
      onDragEnter={(event) => event.stopPropagation()}
      onDragLeave={(event) => event.stopPropagation()}
      className={cn('flex min-h-0 shrink-0 flex-col', !open && 'border-t border-border')}
      style={open ? { height: resize.height, minHeight: resize.minHeight } : undefined}
    >
      {open ? (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('sidebar.resizeFiles', 'Resize Files section')}
          aria-valuemin={Math.round(resize.minHeight)}
          aria-valuemax={Math.round(resize.maxHeight)}
          aria-valuenow={Math.round(resize.height ?? resize.minHeight)}
          tabIndex={0}
          className="group flex h-1.5 shrink-0 cursor-row-resize touch-none items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring"
          {...resize.handleProps}
        >
          <div
            className={cn(
              'h-px w-full bg-worktree-sidebar-border group-hover:bg-worktree-sidebar-foreground/40 group-active:bg-worktree-sidebar-ring',
              resize.isResizing && 'bg-worktree-sidebar-ring'
            )}
          />
        </div>
      ) : null}
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
