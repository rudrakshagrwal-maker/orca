import { expect, it, vi } from 'vitest'
import type { Store } from '../persistence/loading-store/store'
import { activateSessionSearch } from './session-search-activation'

const install = vi.hoisted(() => vi.fn())
vi.mock('./session-search-enablement', () => ({ installChildSessionSearchService: install }))
vi.mock('./scope/session-search-store-scope-catalog', () => ({
  sessionSearchScopeCatalogFromStore: vi.fn()
}))

it('leaves the search service uninstalled until first activation and coalesces repeated opens', async () => {
  expect(install).not.toHaveBeenCalled()
  const store = { getSettings: () => ({}) } as Store
  await Promise.all([activateSessionSearch(store, '/data'), activateSessionSearch(store, '/data')])
  expect(install).toHaveBeenCalledOnce()
  expect(install.mock.calls[0][0].dataRoot).toBe('/data')
})
