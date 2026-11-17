import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installApi, installBrowserGlobals } from './web-preload-api-test-harness'
beforeEach(() => vi.resetModules())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock('./web-runtime-client')
})
// RA: retained shortcuts persist while the removed palette cannot claim input.
it('roundtrips terminal overrides and rejects a conflicting browser chord', async () => {
  const { api } = await installApi('Windows NT 10.0')
  await api.keybindings.setAction({ actionId: 'tab.newTerminal', bindings: ['Ctrl+Alt+Y'] })
  expect((await api.keybindings.get()).overrides).toEqual({ 'tab.newTerminal': ['Ctrl+Alt+Y'] })
  await expect(
    api.keybindings.setAction({ actionId: 'tab.newBrowser', bindings: ['Ctrl+Alt+Y'] })
  ).rejects.toThrow('conflicts')
  await api.keybindings.setAction({ actionId: 'tab.newTerminal', bindings: [] })
  expect((await api.keybindings.reload()).overrides).toEqual({ 'tab.newTerminal': [] })
  await api.keybindings.setAction({ actionId: 'tab.newTerminal', bindings: null })
  expect((await api.keybindings.get()).overrides).toEqual({})
})
it('drops saved palette bindings and keeps explicit terminal disablement', async () => {
  const { storage } = installBrowserGlobals('MacIntel')
  storage.setItem(
    'orca.web.keybindings.v1',
    JSON.stringify({ keybindings: { 'worktree.palette': ['Mod+J'], 'terminal.clear': [] } })
  )
  const { installWebPreloadApi } = await import('./web-preload-api')
  installWebPreloadApi()
  expect((await window.api.keybindings.get()).overrides).toEqual({ 'terminal.clear': [] })
  await expect(
    window.api.keybindings.setAction({ actionId: 'worktree.palette', bindings: ['Mod+J'] })
  ).rejects.toThrow('Unknown keybinding action')
})
