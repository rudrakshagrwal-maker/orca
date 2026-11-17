import { describe, expect, it } from 'vitest'
import { withFreshOmpLaunch } from './omp-fresh-launch'
import { buildAgentStartupPlan } from './tui-agent-startup'

describe('OMP fresh launch intent', () => {
  it.each([
    'omp --resume id',
    'omp -r id',
    'omp --continue',
    'omp -c',
    'omp --session-dir /custom',
    'omp --no-session',
    'omp --fork id',
    'omp models',
    'omp config',
    'omp wt',
    'omp --help',
    'omp --unknown foo',
    'omp --model',
    'omp -- hello',
    'echo omp',
    'omp && echo hi',
    'omp --model foo;',
    'omp --model $(preferred-model)',
    'omp --model `preferred-model`'
  ])('preserves %s', (command) => {
    expect(withFreshOmpLaunch(command, 'posix')).toBe(command)
  })
  it.each(['cmd', 'powershell'] as const)('preserves compound values in %s', (shell) => {
    const command = 'omp --model foo&'
    expect(withFreshOmpLaunch(command, shell)).toBe(command)
  })
})
