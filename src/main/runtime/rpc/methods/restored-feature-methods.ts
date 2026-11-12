import { eraseRpcMethods, isStreamingMethod, type RpcAnyMethodDeclaration } from '../core'

// RA: schemas, provider clients and services enter memory only on a matching request.
const groups = new Map<string, Promise<readonly RpcAnyMethodDeclaration[]>>()

export type RestoredRpcDeclaration =
  | (typeof import('./source-control/github/github.js').GITHUB_METHODS)[number]
  | (typeof import('./source-control/gitlab/gitlab.js').GITLAB_METHODS)[number]
  | (typeof import('./integrations/linear/linear.js').LINEAR_METHODS)[number]
  | (typeof import('./integrations/jira/jira.js').JIRA_METHODS)[number]
  | (typeof import('./automations/automations.js').AUTOMATION_METHODS)[number]
  | (typeof import('./history/ai-vault.js').AI_VAULT_METHODS)[number]
  | (typeof import('./plugins/plugins.js').PLUGIN_METHODS)[number]
  | (typeof import('./plugins/plugin-install-methods.js').PLUGIN_INSTALL_METHODS)[number]

async function loadGroup(prefix: string): Promise<readonly RpcAnyMethodDeclaration[]> {
  switch (prefix) {
    case 'github': return (await import('./source-control/github/github.js')).GITHUB_METHODS
    case 'gitlab': return (await import('./source-control/gitlab/gitlab.js')).GITLAB_METHODS
    case 'linear': return (await import('./integrations/linear/linear.js')).LINEAR_METHODS
    case 'jira': return (await import('./integrations/jira/jira.js')).JIRA_METHODS
    case 'automation': return (await import('./automations/automations.js')).AUTOMATION_METHODS
    case 'aiVault': return (await import('./history/ai-vault.js')).AI_VAULT_METHODS
    case 'plugins': {
      const methods = await import('./plugins/plugins.js')
      const installs = await import('./plugins/plugin-install-methods.js')
      return [...methods.PLUGIN_METHODS, ...installs.PLUGIN_INSTALL_METHODS]
    }
    default: return []
  }
}

export function loadRestoredFeatureMethods(name: string): Promise<readonly RpcAnyMethodDeclaration[]> {
  const prefix = name.split('.')[0] ?? ''
  if (!['github', 'gitlab', 'linear', 'jira', 'automation', 'aiVault', 'plugins'].includes(prefix)) {
    return Promise.resolve([])
  }
  let pending = groups.get(prefix)
  if (!pending) {
    pending = loadGroup(prefix).then((methods) => {
      const feature = prefix === 'automation' ? 'automations'
        : prefix === 'aiVault' ? 'session-search' : prefix === 'plugins' ? 'plugins' : null
      if (!feature) return methods
      // RA: normal dispatcher permission checks and schema validation precede service activation.
      return eraseRpcMethods(methods).map((method): RpcAnyMethodDeclaration => {
        const activate = async (): Promise<void> => {
          const { activateRestoredFeature } = await import('../../../startup/restored-feature-activation.js')
          await activateRestoredFeature(feature)
        }
        if (isStreamingMethod(method)) {
          return { ...method, handler: async (params, context, emit) => {
            await activate()
            await method.handler(params, context, emit)
          } }
        }
        return { ...method, handler: async (params, context) => {
          await activate()
          return method.handler(params, context)
        } }
      })
    }).catch((error) => { groups.delete(prefix); throw error })
    groups.set(prefix, pending)
  }
  return pending
}
