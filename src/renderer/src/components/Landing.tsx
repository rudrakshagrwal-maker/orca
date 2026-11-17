import { useMemo } from 'react'
import { FolderPlus } from 'lucide-react'
import { useAppStore } from '../store/index'

import { useShortcutKeyDetails } from '@/hooks/useShortcutLabel'
import { useTranslate } from '@/i18n/use-translate'
import {
  LANDING_ACTION_BUTTON_CLASS,
  LandingBrand,
  LandingShortcutList,
  type LandingShortcutItem
} from './landing-layout'

// RA: Landing has no star nags, onboarding tips or recurring preflight probes.
export default function Landing(): React.JSX.Element {
  const t = useTranslate()
  const repos = useAppStore((s) => s.repos)
  const openModal = useAppStore((s) => s.openModal)

  const moveUpLabel = t('auto.components.Landing.moveUpWorkspace', 'Move up workspace')
  const moveDownLabel = t('auto.components.Landing.moveDownWorkspace', 'Move down workspace')
  const hasProjects = repos.length > 0

  const previousWorktreeShortcut = useShortcutKeyDetails('worktree.navigateUp')
  const nextWorktreeShortcut = useShortcutKeyDetails('worktree.navigateDown')
  const shortcuts = useMemo<LandingShortcutItem[]>(() => {
    return [
      { id: 'up', shortcut: previousWorktreeShortcut, action: moveUpLabel },
      { id: 'down', shortcut: nextWorktreeShortcut, action: moveDownLabel }
    ]
  }, [moveUpLabel, moveDownLabel, nextWorktreeShortcut, previousWorktreeShortcut])

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background">
      <div className="w-full max-w-lg px-6">
        <div className="flex flex-col items-center gap-4 py-8">
          <LandingBrand />

          <p className="text-sm text-muted-foreground text-center">
            {hasProjects
              ? t(
                  'auto.components.Landing.9c00bd4adf',
                  'Select a workspace from the sidebar to begin.'
                )
              : t('auto.components.Landing.cd21242762', 'Add a project to get started.')}
          </p>

          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            <button className={LANDING_ACTION_BUTTON_CLASS} onClick={() => openModal('add-repo')}>
              <FolderPlus className="size-3.5" />
              {t('auto.components.Landing.f9eaa9e12d', 'Add project')}
            </button>
          </div>

          <LandingShortcutList shortcuts={shortcuts} />
        </div>
      </div>
    </div>
  )
}
