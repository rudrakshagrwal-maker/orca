import { expect, it } from 'vitest'
import { createUIStore, makePersistedUI } from './ui-slice-test-harness'
import { persistedUIWriteFieldsToWireUpdate } from './persisted-ui-write-baseline'

it('restores the selected sidebar panel from the persisted UI wire update', () => {
  const store = createUIStore()
  store.getState().setSidebarView('search')
  const patch = persistedUIWriteFieldsToWireUpdate({ sidebarView: store.getState().sidebarView })
  const restarted = createUIStore()
  restarted.getState().hydratePersistedUI(makePersistedUI(patch), 'startup')
  expect(restarted.getState().sidebarView).toBe('search')
})
