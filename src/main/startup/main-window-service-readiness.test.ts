import { expect, it } from 'vitest'
import { requireMainWindowServices } from './main-window-service-readiness'

// RA: opening terminals must not depend on deleted feature services.
it('admits boot with only terminal, account and keybinding services', () => {
  const services = {
    store: {},
    runtime: {},
    stats: {},
    codexAccounts: {},
    codexRuntimeHome: {},
    claudeAccounts: {},
    claudeRuntimeAuth: {},
    keybindings: {}
  }
  expect(requireMainWindowServices(services)).toBe(services)
})
