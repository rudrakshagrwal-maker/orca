import { eraseRpcMethods, isStreamingMethod, type RpcAnyMethodDeclaration } from '../core'
import type { BOT_METHODS } from './bots/bots'
import type { STRUCTURED_AGENT_SESSION_METHODS } from './structured-sessions/structured-agent-session'
import type { STRUCTURED_AGENT_SESSION_AGENTS_METHODS } from './structured-sessions/catalog/structured-agent-session-agents'
import type { GITHUB_METHODS } from './source-control/github/github'
import type { GITLAB_METHODS } from './source-control/gitlab/gitlab'
import type { LINEAR_METHODS } from './integrations/linear/linear'
import type { JIRA_METHODS } from './integrations/jira/jira'
import type { AUTOMATION_METHODS } from './automations/automations'
import type { AI_VAULT_METHODS } from './history/ai-vault'
import type { PLUGIN_METHODS } from './plugins/plugins'
import type { PLUGIN_INSTALL_METHODS } from './plugins/plugin-install-methods'

// RA: schemas, provider clients and services enter memory only on a matching request.
const groups = new Map<string, Promise<readonly RpcAnyMethodDeclaration[]>>()
let activateFeature: ((feature: string) => Promise<void>) | undefined

// RA: desktop activation is injected; headless bundles must not import Electron startup.
export function setRestoredFeatureActivator(activate: (feature: string) => Promise<void>): void {
  activateFeature = activate
}

export type RestoredRpcDeclaration =
  | (typeof BOT_METHODS)[number]
  | (typeof STRUCTURED_AGENT_SESSION_METHODS)[number]
  | (typeof STRUCTURED_AGENT_SESSION_AGENTS_METHODS)[number]
  | (typeof GITHUB_METHODS)[number]
  | (typeof GITLAB_METHODS)[number]
  | (typeof LINEAR_METHODS)[number]
  | (typeof JIRA_METHODS)[number]
  | (typeof AUTOMATION_METHODS)[number]
  | (typeof AI_VAULT_METHODS)[number]
  | (typeof PLUGIN_METHODS)[number]
  | (typeof PLUGIN_INSTALL_METHODS)[number]

async function loadGroup(prefix: string): Promise<readonly RpcAnyMethodDeclaration[]> {
  switch (prefix) {
    case 'bots':
      return (await import('./bots/bots.js')).BOT_METHODS
    case 'agentSession':
      return [
        ...(await import('./structured-sessions/structured-agent-session.js'))
          .STRUCTURED_AGENT_SESSION_METHODS,
        ...(await import('./structured-sessions/catalog/structured-agent-session-agents.js'))
          .STRUCTURED_AGENT_SESSION_AGENTS_METHODS
      ]
    case 'github':
      return (await import('./source-control/github/github.js')).GITHUB_METHODS
    case 'gitlab':
      return (await import('./source-control/gitlab/gitlab.js')).GITLAB_METHODS
    case 'linear':
      return (await import('./integrations/linear/linear.js')).LINEAR_METHODS
    case 'jira':
      return (await import('./integrations/jira/jira.js')).JIRA_METHODS
    case 'automation':
      return (await import('./automations/automations.js')).AUTOMATION_METHODS
    case 'aiVault':
      return (await import('./history/ai-vault.js')).AI_VAULT_METHODS
    case 'plugins': {
      const methods = await import('./plugins/plugins.js')
      const installs = await import('./plugins/plugin-install-methods.js')
      return [...methods.PLUGIN_METHODS, ...installs.PLUGIN_INSTALL_METHODS]
    }
    default:
      return []
  }
}

export function loadRestoredFeatureMethods(
  name: string
): Promise<readonly RpcAnyMethodDeclaration[]> {
  const prefix = name.split('.')[0] ?? ''
  if (
    ![
      'bots',
      'agentSession',
      'github',
      'gitlab',
      'linear',
      'jira',
      'automation',
      'aiVault',
      'plugins'
    ].includes(prefix)
  ) {
    return Promise.resolve([])
  }
  let pending = groups.get(prefix)
  if (!pending) {
    pending = loadGroup(prefix)
      .then((methods) => {
        const feature =
          prefix === 'automation'
            ? 'automations'
            : prefix === 'aiVault'
              ? 'session-search'
              : prefix === 'plugins'
                ? 'plugins'
                : null
        if (!feature) {
          return methods
        }
        // RA: normal dispatcher permission checks and schema validation precede service activation.
        return eraseRpcMethods(methods).map((method): RpcAnyMethodDeclaration => {
          const activate = async (): Promise<void> => {
            await activateFeature?.(feature)
          }
          if (isStreamingMethod(method)) {
            return {
              ...method,
              handler: async (params, context, emit) => {
                await activate()
                await method.handler(params, context, emit)
              }
            }
          }
          return {
            ...method,
            handler: async (params, context) => {
              await activate()
              return method.handler(params, context)
            }
          }
        })
      })
      .catch((error) => {
        groups.delete(prefix)
        throw error
      })
    groups.set(prefix, pending)
  }
  return pending
}
