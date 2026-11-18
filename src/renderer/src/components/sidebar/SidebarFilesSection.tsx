import { Suspense } from 'react'
import { lazyWithRetry } from '@/app-shell/startup/lazy-with-retry'

const FileExplorer = lazyWithRetry(
  () => import('../right-sidebar/file-explorer/panel/FileExplorer')
)

export function SidebarFilesSection(): React.JSX.Element {
  return (
    <div
      onDragEnter={(event) => event.stopPropagation()}
      onDragLeave={(event) => event.stopPropagation()}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <Suspense fallback={null}>
        <FileExplorer />
      </Suspense>
    </div>
  )
}
