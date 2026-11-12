import { MoreHorizontal, PanelLeft } from 'lucide-react'
import logo from '../../../../resources/logo.svg'
import { useTranslate } from '@/i18n/use-translate'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { useShortcutLabel } from '../hooks/useShortcutLabel'
import { useAppStore } from '../store/index'
import { hasCustomTitleBar, hasMacTrafficLights } from './app-window-chrome'
import type { AppChromeLayout } from './use-app-chrome-layout'

/** Reuse left chrome across full-width and sidebar-width headers so controls/popovers stay consistent. */
export function TitlebarLeftControls({ layout }: { layout: AppChromeLayout }): React.JSX.Element {
  const t = useTranslate()
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const leftSidebarShortcutLabel = useShortcutLabel('sidebar.left.toggle')

  return (
    // Measure the whole row for tab-strip spacing. w-max prevents the collapsed w-0 wrapper shrinking Windows text to one glyph.
    <div
      ref={layout.titlebarLeftControlsRef}
      className={`flex h-full shrink-0 items-center${
        layout.leftTitlebarChromeLayout.isFloating ? ' w-max' : ' w-full'
      }`}
    >
      <div className="flex h-full items-center">
        {hasMacTrafficLights && !layout.isFullScreen ? (
          <div className="titlebar-traffic-light-pad" />
        ) : hasCustomTitleBar ? (
          /* Replace native Windows/Linux chrome with logo and application-menu access. */
          <>
            <img src={logo} alt="" aria-hidden className="titlebar-logo" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="titlebar-icon-button"
                  aria-label={t('auto.App.8b0b8eb54f', 'Application menu')}
                  onClick={() => window.api.ui.popupMenu()}
                >
                  <MoreHorizontal size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {t('auto.App.8b0b8eb54f', 'Application menu')}
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <div className="pl-2" />
        )}
        {layout.showSidebar && !hasCustomTitleBar && layout.showTitlebarAppName && (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="titlebar-app-name" aria-label={t('auto.App.5096cbbc86', 'Orca')}>
                <span className="titlebar-app-name-main">{t('auto.App.5096cbbc86', 'Orca')}</span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onSelect={() => {
                  void updateSettings({ showTitlebarAppName: false })
                }}
              >
                {t('auto.App.e81217c1b7', 'Hide App Name')}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )}
        {layout.showSidebar && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="sidebar-toggle"
                onClick={toggleSidebar}
                aria-label={t('auto.App.e4b9e7dff7', 'Toggle sidebar')}
              >
                <PanelLeft size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {t('auto.App.ce37cf5279', 'Toggle sidebar ({{value0}})', {
                value0: leftSidebarShortcutLabel
              })}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {/* RA: workspace history buttons are intentionally absent. */}
    </div>
  )
}
