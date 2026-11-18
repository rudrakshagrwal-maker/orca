import { eraseRpcMethods, type RpcAnyMethodDeclaration } from '../core'

let methods: Promise<readonly RpcAnyMethodDeclaration[]> | undefined

export function loadSessionSearchMethods(
  name: string
): Promise<readonly RpcAnyMethodDeclaration[]> {
  if (!name.startsWith('aiVault.')) {
    return Promise.resolve([])
  }
  methods ??= load().catch((error) => {
    methods = undefined
    throw error
  })
  return methods
}

async function load(): Promise<readonly RpcAnyMethodDeclaration[]> {
  const { AI_VAULT_METHODS } = await import('./history/ai-vault')
  return eraseRpcMethods(AI_VAULT_METHODS).map((method) => ({
    ...method,
    handler: async (params, context) => {
      // Admission and permission checks run before a request can activate desktop indexing.
      if (method.name === 'aiVault.searchSessions') {
        const { mainProcessState } = await import('../../../startup/main-process-state')
        if (mainProcessState.store) {
          const { app } = await import('electron')
          const { activateSessionSearch } =
            await import('../../../ai-vault-search/session-search-activation')
          await activateSessionSearch(mainProcessState.store, app.getPath('userData'))
        }
      }
      return method.handler(params, context)
    }
  }))
}
