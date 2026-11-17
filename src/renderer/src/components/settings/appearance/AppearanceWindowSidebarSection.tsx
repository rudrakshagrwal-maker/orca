// RA: removed status-bar usage and task controls have no appearance settings.
import type React from 'react'

import type { GlobalSettings } from '../../../../../shared/global-settings-types'

import { SearchableSetting } from '../section-layout/SearchableSetting'
import { AppearanceAdvancedDisclosure } from './AppearanceAdvancedDisclosure'
import { useAppStore } from '../../../store/index'
import {
  SettingsRow,
  SettingsSegmentedControl,
  SettingsSubsectionHeader,
  SettingsSwitchRow
} from '../form-controls/SettingsFormControls'

import { getLayoutEntries, getFollowSymlinkedDirectoriesEntry } from './appearance-search'
import {
  getSidebarEntries,
  getLeftSidebarAppearanceEntry,
  getShowPinnedWorktreesInGroupsEntry,
  getWorkspaceCardLayoutEntry
} from './appearance-sidebar-search'

import { LeftSidebarAppearanceSetting } from './LeftSidebarAppearanceSetting'

import { useTranslate } from '@/i18n/use-translate'
import { matchesSettingsSearch, normalizeSettingsSearchQuery } from '../search/settings-search'

type AppearanceWindowSidebarSectionProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
  forceVisiblePrimary?: boolean
}

/** Window & Sidebar appearance section: sidebar/chrome appearance, status bar controls, and layout advanced settings. */
export function AppearanceWindowSidebarSection({
  settings,
  updateSettings,
  forceVisiblePrimary = false
}: AppearanceWindowSidebarSectionProps): React.JSX.Element {
  const t = useTranslate()
  const searchQuery = useAppStore((state) => state.settingsSearchQuery)
  const isSearching = normalizeSettingsSearchQuery(searchQuery).length > 0

  const setWorktreeCardMode = useAppStore((state) => state.setWorktreeCardMode)

  const leftSidebarAppearanceEntry = getLeftSidebarAppearanceEntry()
  const sidebarEntries = getSidebarEntries()
  const workspaceCardLayoutEntry = getWorkspaceCardLayoutEntry()
  const layoutEntries = getLayoutEntries()
  const followSymlinkEntry = getFollowSymlinkedDirectoriesEntry(t)

  const sidebarAdvancedMatches = matchesSettingsSearch(searchQuery, [
    workspaceCardLayoutEntry,
    ...sidebarEntries
  ])
  const fileExplorerAdvancedMatches = matchesSettingsSearch(searchQuery, layoutEntries)

  const showSidebarAdvanced = !isSearching || sidebarAdvancedMatches
  const showFileExplorerAdvanced = !isSearching || fileExplorerAdvancedMatches
  const showAdvanced = showSidebarAdvanced || showFileExplorerAdvanced

  return (
    <div className="space-y-2">
      <div className="divide-y divide-border/40">
        <SearchableSetting
          title={leftSidebarAppearanceEntry.title}
          description={leftSidebarAppearanceEntry.description}
          keywords={leftSidebarAppearanceEntry.keywords}
          className="space-y-2"
          forceVisible={forceVisiblePrimary}
        >
          <LeftSidebarAppearanceSetting settings={settings} updateSettings={updateSettings} />
        </SearchableSetting>
      </div>

      {showAdvanced ? (
        <AppearanceAdvancedDisclosure contentClassName="ml-4 pt-4">
          <div className="space-y-4">
            {showSidebarAdvanced ? (
              <div className="space-y-3">
                <SettingsSubsectionHeader
                  title={t('auto.components.settings.AppearancePane.dc29f3cc0d', 'Sidebar')}
                />
                <div className="ml-4 divide-y divide-border/40">
                  <SearchableSetting
                    title={workspaceCardLayoutEntry.title}
                    description={workspaceCardLayoutEntry.description}
                    keywords={workspaceCardLayoutEntry.keywords}
                  >
                    <SettingsRow
                      label={workspaceCardLayoutEntry.title}
                      description={workspaceCardLayoutEntry.description}
                      control={
                        <SettingsSegmentedControl
                          value={settings.compactWorktreeCards ? 'compact' : 'detailed'}
                          onChange={(value) =>
                            setWorktreeCardMode(value === 'compact' ? 'Compact' : 'Default')
                          }
                          ariaLabel={workspaceCardLayoutEntry.title}
                          options={[
                            {
                              value: 'detailed',
                              label: t(
                                'auto.components.sidebar.SidebarWorkspaceOptionsMenu.cc17bd443b',
                                'Detailed'
                              )
                            },
                            {
                              value: 'compact',
                              label: t(
                                'auto.components.sidebar.SidebarWorkspaceOptionsMenu.25105b28cb',
                                'Compact'
                              )
                            }
                          ]}
                        />
                      }
                    />
                  </SearchableSetting>

                  {/* RA: no Orca Mobile control without a relay. */}

                  <SearchableSetting
                    title={getShowPinnedWorktreesInGroupsEntry().title}
                    description={getShowPinnedWorktreesInGroupsEntry().description}
                    keywords={getShowPinnedWorktreesInGroupsEntry().keywords}
                  >
                    <SettingsSwitchRow
                      label={t(
                        'auto.components.settings.AppearancePane.showPinnedWorktreesInGroups.title',
                        'Also show pinned worktrees in their original lists'
                      )}
                      // This opt-in duplicates pinned worktrees into natural groups while preserving Pinned.
                      description={t(
                        'auto.components.settings.AppearancePane.showPinnedWorktreesInGroups.description',
                        'Pinned worktrees stay in Pinned and also appear in All, Project, Status, and PR.'
                      )}
                      checked={settings.showPinnedWorktreesInGroups === true}
                      onChange={() =>
                        updateSettings({
                          showPinnedWorktreesInGroups: !(
                            settings.showPinnedWorktreesInGroups === true
                          )
                        })
                      }
                    />
                  </SearchableSetting>
                </div>
              </div>
            ) : null}

            {showFileExplorerAdvanced ? (
              <div className="space-y-3">
                <SettingsSubsectionHeader
                  title={t('auto.components.settings.AppearancePane.8e374ce9a3', 'File explorer')}
                />
                <div className="ml-4 divide-y divide-border/40">
                  <SearchableSetting
                    title={
                      layoutEntries[0]?.title ??
                      t(
                        'auto.components.settings.AppearancePane.7e958ee950',
                        'Show Git-ignored files'
                      )
                    }
                    description={layoutEntries[0]?.description}
                    keywords={layoutEntries[0]?.keywords ?? ['git', 'gitignore', 'ignored']}
                  >
                    <SettingsSwitchRow
                      label={t(
                        'auto.components.settings.AppearancePane.7e958ee950',
                        'Show Git-ignored files'
                      )}
                      description={t(
                        'auto.components.settings.AppearancePane.gitIgnoredGlossary',
                        'Files matched by .gitignore.'
                      )}
                      checked={settings.showGitIgnoredFiles ?? true}
                      onChange={() =>
                        updateSettings({
                          showGitIgnoredFiles: !(settings.showGitIgnoredFiles ?? true)
                        })
                      }
                    />
                  </SearchableSetting>
                  <SearchableSetting {...followSymlinkEntry}>
                    <SettingsSwitchRow
                      label={followSymlinkEntry.title}
                      description={followSymlinkEntry.description}
                      checked={settings.followSymlinkedDirectories ?? false}
                      onChange={() =>
                        updateSettings({
                          followSymlinkedDirectories: !settings.followSymlinkedDirectories
                        })
                      }
                    />
                  </SearchableSetting>
                </div>
              </div>
            ) : null}
          </div>
        </AppearanceAdvancedDisclosure>
      ) : null}
    </div>
  )
}
