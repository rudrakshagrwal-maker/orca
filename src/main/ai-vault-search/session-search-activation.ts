import type { Store } from '../persistence/loading-store/store'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'

let activation: Promise<void> | undefined

export function activateSessionSearch(store: Store, dataRoot: string): Promise<void> {
  activation ??= install(store, dataRoot).catch((error) => {
    activation = undefined
    throw error
  })
  return activation
}

async function install(store: Store, dataRoot: string): Promise<void> {
  const { installChildSessionSearchService } = await import('./session-search-enablement')
  const { sessionSearchScopeCatalogFromStore } =
    await import('./scope/session-search-store-scope-catalog')
  installChildSessionSearchService({
    dataRoot,
    getSettings: () => store.getSettings(),
    getScopeCatalog: () => sessionSearchScopeCatalogFromStore(store, LOCAL_EXECUTION_HOST_ID)
  })
}
