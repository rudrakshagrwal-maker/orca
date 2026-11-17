import React from 'react'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { SidebarHeaderActions } from './sidebar-header-actions'

// RA: Projects keeps its collapse control and agent tree, without the Agents history tab or tips.
export default function SidebarHeader({
  projectsCollapseTarget
}: {
  projectsCollapseTarget?: React.Ref<HTMLDivElement>
}): React.JSX.Element {
  const t = useTranslate()
  const groupBy = useAppStore((s) => s.groupBy)
  return (
    <div className="group/sidebar-header mt-2 flex h-8 min-w-0 shrink-0 items-center justify-between gap-1.5 px-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {groupBy === 'repo'
            ? t('dashboard.sidebar.projects', 'Projects')
            : t('dashboard.sidebar.workspaces', 'Workspaces')}
        </span>
        <div ref={projectsCollapseTarget} className="flex shrink-0 items-center empty:hidden" />
      </div>
      <SidebarHeaderActions />
    </div>
  )
}
