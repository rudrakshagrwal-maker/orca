import type { CommandHandler } from './dispatch'
import { BROWSER_HANDLER_GROUPS } from './browser/browser-handler-groups'

import { HOST_HANDLER_GROUPS } from './host-handler-groups'
import { WORKTREE_HANDLER_GROUPS } from './worktree-handler-groups'

export type HandlerGroup = {
  name: string
  // Eager keys allow routing and duplicate checks without importing each handler graph.
  keys: readonly string[]
  load: () => Promise<Record<string, CommandHandler>>
}

// handler-group-manifest.test.ts checks keys against the real exports to prevent drift.
export const HANDLER_GROUPS: readonly HandlerGroup[] = [
  {
    name: 'core',
    keys: ['open', 'serve', 'status'],
    load: async () => (await import('./handlers/core.js')).CORE_HANDLERS
  },

  {
    name: 'serve-reset-identity',
    keys: ['serve reset-identity'],
    load: async () =>
      (await import('./handlers/serve-reset-identity.js')).SERVE_RESET_IDENTITY_HANDLERS
  },
  {
    name: 'serve-service',
    keys: ['serve service install', 'serve service status', 'serve service uninstall'],
    load: async () => (await import('./handlers/serve-service.js')).SERVE_SERVICE_HANDLERS
  },
  {
    name: 'account',
    keys: ['account add', 'account list', 'account select', 'account rm'],
    load: async () => (await import('./handlers/account.js')).ACCOUNT_HANDLERS
  },

  {
    name: 'project',
    keys: [
      'project list',
      'project setups',
      'project setup-existing-folder',
      'project setup-clone',
      'project setup-create',
      'project setup-update',
      'project setup-delete'
    ],
    load: async () => (await import('./handlers/project.js')).PROJECT_HANDLERS
  },
  {
    name: 'repo',
    keys: [
      'repo list',
      'repo add',
      'repo show',
      'repo set',
      'repo set-base-ref',
      'repo search-refs'
    ],
    load: async () => (await import('./handlers/repo.js')).REPO_HANDLERS
  },
  ...WORKTREE_HANDLER_GROUPS,
  {
    name: 'file',
    keys: ['file open', 'file diff', 'file open-changed'],
    load: async () => (await import('./handlers/file.js')).FILE_HANDLERS
  },
  {
    name: 'terminal',
    keys: [
      'terminal list',
      'terminal show',
      'terminal read',
      'terminal send',
      'terminal wait',
      'terminal stop',
      'terminal rename',
      'terminal set-pane-title',
      'terminal set-parent', // RA: post-launch lineage attachment.
      'terminal create',
      'terminal switch',
      'terminal close',
      'terminal split'
    ],
    load: async () => (await import('./handlers/terminal.js')).TERMINAL_HANDLERS
  },
  ...BROWSER_HANDLER_GROUPS,
  {
    name: 'orchestration',
    keys: [
      'orchestration run-create',
      'orchestration run-use',
      'orchestration run-current',
      'orchestration run-list',
      'orchestration run-show',
      'orchestration send',
      'orchestration check',
      'orchestration reply',
      'orchestration inbox',
      'orchestration task-create',
      'orchestration task-list',
      'orchestration task-update',
      'orchestration worker-start',
      'orchestration worker-show',
      'orchestration worker-read',
      'orchestration worker-stop',
      'orchestration deny',
      'orchestration worker-abandon',
      'orchestration worker-release',
      'orchestration worker-keep-open',
      'orchestration worker-list',
      'orchestration dispatch',
      'orchestration ask',
      'orchestration dispatch-show',
      'orchestration request-show',
      'orchestration gate-create',
      'orchestration gate-resolve',
      'orchestration gate-list',
      'orchestration reset'
    ],
    load: async () => (await import('./handlers/orchestration.js')).ORCHESTRATION_HANDLERS
  },
  {
    name: 'agent-hooks',
    keys: ['agent hooks status', 'agent hooks off', 'agent hooks on'],
    load: async () => (await import('./handlers/agent-hooks.js')).AGENT_HOOK_HANDLERS
  },
  {
    name: 'agent-launch',
    keys: ['agent launch'],
    load: async () => (await import('./handlers/agent-launch.js')).AGENT_LAUNCH_HANDLERS
  },
  {
    name: 'profile-state',
    keys: ['profile state exports', 'profile state rollback'],
    load: async () => (await import('./handlers/profile-state.js')).PROFILE_STATE_HANDLERS
  },
  {
    name: 'terminal-daemon',
    keys: ['terminal-daemon status', 'terminal-daemon restart'],
    load: async () => (await import('./handlers/terminal-daemon.js')).TERMINAL_DAEMON_HANDLERS
  },
  {
    name: 'introspection',
    keys: ['agent-context'],
    load: async () => (await import('./handlers/introspection.js')).INTROSPECTION_HANDLERS
  },
  ...HOST_HANDLER_GROUPS,

  {
    name: 'skills',
    keys: ['skills list', 'skills get', 'skills install', 'skills update'],
    load: async () => (await import('./handlers/skills.js')).SKILL_HANDLERS
  }
]
