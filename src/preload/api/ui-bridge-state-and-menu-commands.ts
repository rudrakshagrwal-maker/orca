// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import type { MarkdownDocument } from '../../shared/file-listing/file-document'
import type { BrowserTabCreateRequest } from '../../shared/browser-tab-create-request'
import { ipcRenderer } from 'electron'
import type { PersistedUIState } from '../../shared/persisted-ui-state-types'
import type { KeybindingActionId } from '../../shared/keybindings'
import type { PreloadApi } from '../api-types'
import type {
  RemoteCliBrowserScopeQuery,
  RemoteCliBrowserScopeReply
} from '../../shared/desktop-browser-bridge-protocol'

export const uiStateAndMenuCommandsApi = {
  get: () => ipcRenderer.invoke('ui:get'),
  set: (args) => ipcRenderer.invoke('ui:set', args),
  setWithAck: (args) => ipcRenderer.invoke('ui:set', args),
  recordFeatureInteraction: (id) => ipcRenderer.invoke('ui:recordFeatureInteraction', id),
  onStateChanged: (callback: (ui: PersistedUIState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ui: PersistedUIState): void => callback(ui)
    ipcRenderer.on('ui:stateChanged', listener)
    return () => ipcRenderer.removeListener('ui:stateChanged', listener)
  },
  onOpenSettings: (callback: () => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('ui:openSettings', listener)
    return () => ipcRenderer.removeListener('ui:openSettings', listener)
  },
  consumePendingOpenSettings: (): Promise<boolean> =>
    ipcRenderer.invoke('ui:consumePendingOpenSettings'),
  onQuitAndStopAllSessions: (callback: () => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('ui:quitAndStopAllSessions', listener)
    return () => ipcRenderer.removeListener('ui:quitAndStopAllSessions', listener)
  },
  consumePendingQuitAndStopAllSessions: (): Promise<boolean> =>
    ipcRenderer.invoke('ui:consumePendingQuitAndStopAllSessions'),
  quitAfterStoppingAllSessions: (): Promise<boolean> =>
    ipcRenderer.invoke('ui:quitAfterStoppingAllSessions'),

  onOpenMarkdownFiles: (callback: (documents: MarkdownDocument[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, documents: MarkdownDocument[]): void =>
      callback(documents)
    ipcRenderer.on('ui:openMarkdownFiles', listener)
    return () => ipcRenderer.removeListener('ui:openMarkdownFiles', listener)
  },
  consumePendingMarkdownFileOpens: (): Promise<MarkdownDocument[]> =>
    ipcRenderer.invoke('ui:consumePendingMarkdownFileOpens'),

  onOpenCrashReport: (callback: () => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('ui:openCrashReport', listener)
    return () => ipcRenderer.removeListener('ui:openCrashReport', listener)
  },
  onToggleLeftSidebar: (callback: () => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('ui:toggleLeftSidebar', listener)
    return () => ipcRenderer.removeListener('ui:toggleLeftSidebar', listener)
  },

  onTerminalShortcutCaptured: (
    callback: (data: { actionId: KeybindingActionId }) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { actionId: KeybindingActionId }) =>
      callback(data)
    ipcRenderer.on('ui:terminalShortcutCaptured', listener)
    return () => ipcRenderer.removeListener('ui:terminalShortcutCaptured', listener)
  },
  onOpenQuickOpen: (callback: () => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('ui:openQuickOpen', listener)
    return () => ipcRenderer.removeListener('ui:openQuickOpen', listener)
  },
  onToggleQuickCommandsMenu: (callback: () => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('ui:toggleQuickCommandsMenu', listener)
    return () => ipcRenderer.removeListener('ui:toggleQuickCommandsMenu', listener)
  },

  onDeleteCurrentWorkspace: (callback: () => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('ui:deleteCurrentWorkspace', listener)
    return () => ipcRenderer.removeListener('ui:deleteCurrentWorkspace', listener)
  },

  onJumpToWorktreeIndex: (callback: (index: number) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, index: number) => callback(index)
    ipcRenderer.on('ui:jumpToWorktreeIndex', listener)
    return () => ipcRenderer.removeListener('ui:jumpToWorktreeIndex', listener)
  },
  onJumpToTabIndex: (callback: (index: number) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, index: number) => callback(index)
    ipcRenderer.on('ui:jumpToTabIndex', listener)
    return () => ipcRenderer.removeListener('ui:jumpToTabIndex', listener)
  },
  onWorktreeHistoryNavigate: (callback: (direction: 'back' | 'forward') => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, direction: 'back' | 'forward') =>
      callback(direction)
    ipcRenderer.on('ui:worktreeHistoryNavigate', listener)
    return () => ipcRenderer.removeListener('ui:worktreeHistoryNavigate', listener)
  },
  onRequestTabCreate: (callback: (data: BrowserTabCreateRequest) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: BrowserTabCreateRequest) =>
      callback(data)
    ipcRenderer.on('browser:requestTabCreate', listener)
    return () => ipcRenderer.removeListener('browser:requestTabCreate', listener)
  },
  replyTabCreate: (reply: { requestId: string; browserPageId?: string; error?: string }): void => {
    ipcRenderer.send('browser:tabCreateReply', reply)
  },
  browserTabRequestsReady: (): void => {
    ipcRenderer.send('browser:tabRequestsReady')
  },
  onRequestRemoteCliBrowserScope: (
    callback: (data: RemoteCliBrowserScopeQuery) => void
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: RemoteCliBrowserScopeQuery) =>
      callback(data)
    ipcRenderer.on('browser:requestRemoteCliScope', listener)
    return () => ipcRenderer.removeListener('browser:requestRemoteCliScope', listener)
  },
  replyRemoteCliBrowserScope: (reply: RemoteCliBrowserScopeReply): void => {
    ipcRenderer.send('browser:remoteCliScopeReply', reply)
  }
} satisfies Partial<PreloadApi['ui']>
