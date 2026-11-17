import { rm } from 'node:fs/promises'
import { afterEach, expect, it, vi } from 'vitest'
import { planCommitMessageGeneration } from '../../shared/source-control/ai/generation/commit-message-plan'
import { prepareSourceControlReadOnlyPlan } from './source-control-read-only-policy'
import './source-control-local-generation'
import './source-control-generation-lanes'

const { probe } = vi.hoisted(() => ({ probe: vi.fn() }))
vi.mock('./source-control-policy-probe', () => ({ runSourceControlPolicyProbe: probe }))
const owned: string[] = []
afterEach(async () => {
  probe.mockReset()
  await Promise.all(
    owned.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})
function planned(agentId: 'codex' | 'kimi' | 'antigravity', agentArgs?: string) {
  const result = planCommitMessageGeneration(
    { agentId, model: agentId === 'codex' ? 'gpt-5.4-mini' : 'default', agentArgs },
    'Name this chat'
  )
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.plan
}
const spawnAgent = vi.fn(() => {
  throw new Error('Unexpected semantic process')
})

it('disables every effective Codex MCP name, including dotted names, after recipe overrides', async () => {
  probe.mockReturnValue({
    result: Promise.resolve({
      stdout:
        '[{"name":"a.b","enabled":true,"transport":{"type":"stdio"}},{"name":"second","enabled":true}]',
      stderr: 'Warning: optional update unavailable'
    }),
    processClosed: Promise.resolve()
  })
  const plan = await prepareSourceControlReadOnlyPlan({
    agentId: 'codex',
    plan: planned(
      'codex',
      '-c features.apps=true -c features.plugins=true -c mcp_servers.a.enabled=true --profile review'
    ),
    target: { kind: 'local', cwd: '/workspace', env: { CODEX_HOME: '/bound-account' } },
    signal: new AbortController().signal,
    spawnAgent
  }).result
  expect(probe.mock.calls[0][0]).toMatchObject({
    target: { cwd: '/workspace', env: { CODEX_HOME: '/bound-account' } },
    args: [
      '-c',
      'features.apps=true',
      '-c',
      'features.plugins=true',
      '-c',
      'mcp_servers.a.enabled=true',
      '--profile',
      'review',
      '-c',
      'features.plugins=false',
      '-c',
      'features.apps=false',
      'mcp',
      'list',
      '--json'
    ]
  })
  expect(plan.args.slice(-6)).toEqual([
    '-c',
    'features.plugins=false',
    '-c',
    'features.apps=false',
    '-c',
    'mcp_servers={"a.b"={enabled=false},"second"={enabled=false}}'
  ])
  probe.mockReturnValue({
    result: Promise.reject(new Error('Unsupported configuration query')),
    processClosed: Promise.resolve()
  })
  await expect(
    prepareSourceControlReadOnlyPlan({
      agentId: 'codex',
      plan: planned('codex'),
      target: { kind: 'local', cwd: '/workspace' },
      signal: new AbortController().signal,
      spawnAgent
    }).result
  ).rejects.toThrow('Unsupported configuration query')
})


