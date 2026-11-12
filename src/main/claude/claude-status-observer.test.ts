import { expect, it } from 'vitest'
import { getClaudeManagedHookPlan } from './claude-managed-hook-events'
import { applyManagedHooks, removeManagedHooks } from './hook-settings'
import { isAgentStatusHooksEnabledForAgent } from '../../shared/agent-hook-listener/configuration/agent-status-hooks-setting'
import { createHookListenerState } from '../../shared/agent-hook-listener/listener-state'
import { normalizeAndAccept } from '../../shared/agent-hook-listener/normalization/agent-hook-listener-test-harness'

// RA: use the production fork policy, not an upstream-mode mock.
it('merges only the four observer events without changing user hooks or their order', () => {
  const config = {
    hooks: {
      SessionStart: [
        { hooks: [{ type: 'command' as const, command: 'memory-inject.py' }] },
        { hooks: [{ type: 'command' as const, command: 'my-second-hook' }] }
      ],
      PreToolUse: [{ hooks: [{ type: 'command' as const, command: 'user-check' }] }]
    },
    statusLine: { command: 'my-statusline' }
  }
  const plan = getClaudeManagedHookPlan('2.1.312')
  expect(plan.install.map((event) => event.eventName)).toEqual([
    'SessionStart',
    'UserPromptSubmit',
    'Stop',
    'Notification'
  ])
  const installed = applyManagedHooks(
    config,
    () => ({ type: 'command', command: '"$HOME/.orca/agent-hooks/claude-hook.sh"' }),
    'claude-hook.sh',
    plan,
    true
  )
  expect(installed.hooks?.SessionStart?.slice(0, 2)).toEqual(config.hooks.SessionStart)
  expect(installed.hooks?.PreToolUse).toEqual(config.hooks.PreToolUse)
  expect(installed.statusLine).toEqual({ command: 'my-statusline' })
  expect(
    applyManagedHooks(
      installed,
      () => ({ type: 'command', command: '"$HOME/.orca/agent-hooks/claude-hook.sh"' }),
      'claude-hook.sh',
      plan,
      true
    )
  ).toEqual(installed)
  expect(removeManagedHooks(installed, 'claude-hook.sh').config).toEqual(config)
  expect(isAgentStatusHooksEnabledForAgent({}, 'claude')).toBe(true)
  expect(isAgentStatusHooksEnabledForAgent({ disabledTuiAgents: ['claude'] }, 'claude')).toBe(false)
  expect(isAgentStatusHooksEnabledForAgent({}, 'codex')).toBe(false)
  expect(isAgentStatusHooksEnabledForAgent({ agentStatusHooksEnabled: false }, 'claude')).toBe(
    false
  )
  const windows = applyManagedHooks(
    config,
    () => ({ type: 'command', command: 'C:/Users/test/.orca/agent-hooks/claude-hook.cmd' }),
    'claude-hook.cmd',
    plan,
    false
  )
  expect(removeManagedHooks(windows, 'claude-hook.cmd').config).toEqual(config)
})

it('normalizes the four approved events and ignores informational notifications', () => {
  const state = createHookListenerState()
  const post = (event: string, fields = {}) =>
    normalizeAndAccept(state, 'claude', {
      hook_event_name: event,
      session_id: '6f1f0b5e-2c3d-4e5f-8a9b-0c1d2e3f4a5b',
      ...fields
    })
  expect(post('SessionStart', { source: 'startup' })?.payload.state).toBe('done')
  expect(post('UserPromptSubmit', { prompt: 'fix it' })?.payload.state).toBe('working')
  expect(post('Notification', { notification_type: 'permission_prompt' })?.payload.state).toBe(
    'waiting'
  )
  expect(post('Notification', { notification_type: 'auth_success' })).toBeNull()
  expect(post('Stop')?.payload.state).toBe('done')
})
