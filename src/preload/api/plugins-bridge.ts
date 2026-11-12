import { invokeRestoredFeature } from './restored-feature-invoke' // RA: first-use gate.
import { ipcRenderer } from 'electron'
import { subscribePluginPanelPush } from './plugin-panel-push-bridge'
import type {
  PluginFrameEntry,
  PluginFrameTheme
} from '../../shared/plugins/frames/plugin-frame-bridge'
import type { PluginHostCallOutcome } from '../../shared/plugins/frames/plugin-protocol'
import type { PluginConsentRequest } from '../../shared/plugins/approval/plugin-consent-request'
import type { PluginChangeEvent } from '../../shared/plugins/events/plugin-change-event'
import {
  PLUGIN_STATUS_BAR_CHANGED_CHANNEL,
  type PluginStatusBarOverrides
} from '../../shared/plugins/contributions/plugin-status-bar-state'
import {
  PLUGIN_VIEW_REPLY_CHANNEL,
  PLUGIN_VIEW_REQUEST_CHANNEL,
  type PluginViewRequest
} from '../../shared/plugins/view/plugin-view-protocol'
import type {
  PluginAutoUpdateEvent,
  PluginHostInstallResult,
  PluginHostInstallSource,
  PluginHostListEntry,
  PluginHostLogLine,
  PreloadApi
} from '../api-types'

export const pluginsApi = {
  list: (): Promise<PluginHostListEntry[]> => invokeRestoredFeature('plugins', 'plugins:list'),
  listLanguagePacks: () => invokeRestoredFeature('plugins', 'plugins:listLanguagePacks'),
  listThemes: () => invokeRestoredFeature('plugins', 'plugins:listThemes'),
  listTerminalThemes: () => invokeRestoredFeature('plugins', 'plugins:listTerminalThemes'),
  listIconThemes: () => invokeRestoredFeature('plugins', 'plugins:listIconThemes'),
  loadIconTheme: (id) => invokeRestoredFeature('plugins', 'plugins:loadIconTheme', id),
  listSyntaxes: () => invokeRestoredFeature('plugins', 'plugins:listSyntaxes'),
  loadSyntax: (id) => invokeRestoredFeature('plugins', 'plugins:loadSyntax', id),
  consent: (args: PluginConsentRequest): Promise<PluginHostListEntry[]> =>
    invokeRestoredFeature('plugins', 'plugins:consent', args),
  setEnabled: (args: { pluginKey: string; enabled: boolean }): Promise<PluginHostListEntry[]> =>
    invokeRestoredFeature('plugins', 'plugins:setEnabled', args),
  readPanelEntry: (args: {
    pluginKey: string
    panelId: string
    theme?: PluginFrameTheme
  }): Promise<PluginFrameEntry | null> => invokeRestoredFeature('plugins', 'plugins:readPanelEntry', args),
  readCustomEditorEntry: (args: {
    pluginKey: string
    editorId: string
    theme?: PluginFrameTheme
  }): Promise<PluginFrameEntry | null> => invokeRestoredFeature('plugins', 'plugins:readCustomEditorEntry', args),
  readNewFileTemplate: (args: { pluginKey: string; newFileId: string }): Promise<string | null> =>
    invokeRestoredFeature('plugins', 'plugins:readNewFileTemplate', args),
  invokeCommand: (args: {
    pluginKey: string
    commandId: string
    args?: unknown
    timeoutMs?: number
  }) => invokeRestoredFeature('plugins', 'plugins:invokeCommand', args),
  panelAction: (args: {
    sessionToken: string
    action: string
    params?: unknown
  }): Promise<PluginHostCallOutcome> => invokeRestoredFeature('plugins', 'plugins:panelAction', args),
  panelState: (args) => invokeRestoredFeature('plugins', 'plugins:panelState', args),
  subscribePanelPush: subscribePluginPanelPush,
  getSettings: (args) => invokeRestoredFeature('plugins', 'plugins:getSettings', args),
  setSetting: (args) => invokeRestoredFeature('plugins', 'plugins:setSetting', args),
  panelImage: (args) => invokeRestoredFeature('plugins', 'plugins:panelImage', args),
  resolveGitSource: (args) => invokeRestoredFeature('plugins', 'plugins:resolveGitSource', args),
  install: (source: PluginHostInstallSource): Promise<PluginHostInstallResult> =>
    invokeRestoredFeature('plugins', 'plugins:install', source),
  listMarketplaces: () => invokeRestoredFeature('plugins', 'plugins:listMarketplaces'),
  addMarketplace: (source) => invokeRestoredFeature('plugins', 'plugins:addMarketplace', source),
  removeMarketplace: (args) => invokeRestoredFeature('plugins', 'plugins:removeMarketplace', args),
  refreshMarketplaces: (args = {}) => invokeRestoredFeature('plugins', 'plugins:refreshMarketplaces', args),
  listMarketplacePlugins: () => invokeRestoredFeature('plugins', 'plugins:listMarketplacePlugins'),
  suggestForFileType: (fileType, purpose) =>
    invokeRestoredFeature('plugins', 'plugins:suggestForFileType', fileType, purpose),
  previewMarketplacePlugin: (args) => invokeRestoredFeature('plugins', 'plugins:previewMarketplacePlugin', args),
  installMarketplacePlugin: (preview) =>
    invokeRestoredFeature('plugins', 'plugins:installMarketplacePlugin', preview),
  previewMarketplaceUpdate: (args) => invokeRestoredFeature('plugins', 'plugins:previewMarketplaceUpdate', args),
  rollbackMarketplacePlugin: (args) =>
    invokeRestoredFeature('plugins', 'plugins:rollbackMarketplacePlugin', args),
  getRollbackVersion: (args) => invokeRestoredFeature('plugins', 'plugins:getRollbackVersion', args),
  getInstalledManifest: (args) => invokeRestoredFeature('plugins', 'plugins:getInstalledManifest', args),
  remove: (args: { pluginKey: string }): Promise<PluginHostListEntry[]> =>
    invokeRestoredFeature('plugins', 'plugins:remove', args),
  getLogs: (args: { pluginKey: string }): Promise<PluginHostLogLine[]> =>
    invokeRestoredFeature('plugins', 'plugins:getLogs', args),
  refresh: (): Promise<PluginHostListEntry[]> => invokeRestoredFeature('plugins', 'plugins:refresh'),
  onChanged: (callback): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, change: PluginChangeEvent): void =>
      callback(change)
    ipcRenderer.on('plugins:changed', listener)
    return () => {
      ipcRenderer.removeListener('plugins:changed', listener)
    }
  },
  onViewRequest: (callback): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, request: PluginViewRequest): void =>
      callback(request)
    ipcRenderer.on(PLUGIN_VIEW_REQUEST_CHANNEL, listener)
    return () => {
      ipcRenderer.removeListener(PLUGIN_VIEW_REQUEST_CHANNEL, listener)
    }
  },
  answerViewRequest: (reply) => ipcRenderer.send(PLUGIN_VIEW_REPLY_CHANNEL, reply),
  getAutoUpdateState: () => invokeRestoredFeature('plugins', 'plugins:getAutoUpdateState'),
  takeUpdateReviewNotices: () => invokeRestoredFeature('plugins', 'plugins:takeUpdateReviewNotices'),
  getInstallCounts: () => invokeRestoredFeature('plugins', 'plugins:getInstallCounts'),
  onInstallCountsChanged: (callback): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('plugins:installCountsChanged', listener)
    return () => {
      ipcRenderer.removeListener('plugins:installCountsChanged', listener)
    }
  },
  statusBarState: () => invokeRestoredFeature('plugins', 'plugins:statusBarState'),
  editorSaveHook: (event) => invokeRestoredFeature('plugins', 'plugins:editorSaveHook', event),
  onStatusBarChanged: (callback): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, overrides: PluginStatusBarOverrides) =>
      callback(overrides)
    ipcRenderer.on(PLUGIN_STATUS_BAR_CHANGED_CHANNEL, listener)
    return () => {
      ipcRenderer.removeListener(PLUGIN_STATUS_BAR_CHANGED_CHANNEL, listener)
    }
  },
  onAutoUpdateChanged: (callback): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, change: PluginAutoUpdateEvent): void =>
      callback(change)
    ipcRenderer.on('plugins:autoUpdateChanged', listener)
    return () => {
      ipcRenderer.removeListener('plugins:autoUpdateChanged', listener)
    }
  }
} satisfies PreloadApi['plugins']
