import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import '../../../../shared/agent-kind'
import { getDefaultSettings } from '../../../../shared/constants'

import type { AgentLaunchRuntime } from '../../../../shared/agent-launch/startup/agent-launch-runtime'

const mocks = vi.hoisted(() => ({
  detectInstalledAgentsWithShellPathHydration: vi.fn(),
  capabilities: vi.fn(),
  executable: vi.fn(),
  modelContext: vi.fn()
}))

vi.mock('../../../preflight/agent-detection', () => ({
  detectInstalledAgentsWithShellPathHydration: mocks.detectInstalledAgentsWithShellPathHydration
}))

vi.mock('../../../opencode/opencode-launch-capabilities', () => ({
  probeOpenCodeLaunchCapabilities: mocks.capabilities
}))
vi.mock('../../../opencode/opencode-model-executable', () => ({
  resolveOpenCodeDirectModelExecutable: mocks.executable
}))
vi.mock('../../../opencode/opencode-launch-model-context', () => ({
  probeOpenCodeLaunchModelContext: mocks.modelContext
}))

import {
  buildWorktreeStartupForAgent,
  buildWorktreeStartupForDraft,
  resolveWorktreeCreateAgentStartup,
  resolveWorktreeStartupDraftAgent
} from './runtime-worktree-agent-startup'

function makeRepo(fields: Partial<Repo>): Repo {
  return {
    id: 'repo-1',
    displayName: 'repo',
    badgeColor: '#737373',
    addedAt: 0,
    path: '/srv/repo',
    connectionId: null,
    executionHostId: null,
    ...fields
  }
}

const LINUX_FACT: AgentLaunchRuntime = {
  platform: 'linux',
  pty: { shellOverride: undefined, terminalWindowsWslDistro: null }
}
const LINUX = { platform: 'linux' as const, shell: 'posix' as const, launchRuntime: LINUX_FACT }

const settings = {
  ...getDefaultSettings('/tmp'),
  agentCmdOverrides: {},
  agentDefaultArgs: {},
  agentDefaultEnv: {},
  disabledTuiAgents: [],
  defaultTuiAgent: null
}

// Host-built startup must use the same shell fact for quoting and spawn.
it('quotes a worktree startup for its fact, not the Settings shell, and hands the fact on', async () => {
  const pty = { shellOverride: 'powershell.exe', terminalWindowsWslDistro: null }
  const launchRuntime: AgentLaunchRuntime = { platform: 'win32', pty }
  const result = await buildWorktreeStartupForAgent({
    repo: makeRepo({ path: 'C:\\repo' }),
    settings: { ...settings, terminalWindowsShell: 'wsl.exe' },
    agent: 'claude',
    prompt: "fix Bob's bug",
    getLaunchRuntime: () => ({ platform: 'win32', shell: 'powershell', launchRuntime }),
    toSessionOptions: () => undefined
  })
  expect(result.startup.command).toContain("'fix Bob''s bug'")
  expect(result.launchRuntime).toBe(launchRuntime)
})

describe('buildWorktreeStartupForAgent prompt carry', () => {
  const build = (onPromptCarry?: (carried: boolean) => void, terminalDefaultShell = '/bin/bash') =>
    buildWorktreeStartupForAgent({
      repo: makeRepo({}),
      settings: Object.assign({}, settings, { terminalDefaultShell }),
      agent: 'claude',
      prompt: 'summarize the diff\nthen list the risks',
      getLaunchRuntime: () => ({
        ...LINUX,
        launchRuntime: {
          ...LINUX_FACT,
          pty: { shellOverride: terminalDefaultShell, terminalWindowsWslDistro: null }
        }
      }),
      toSessionOptions: () => undefined,
      ...(onPromptCarry ? { onPromptCarry } : {})
    })

  it('starts clean and reports it when a caller that pastes offers a prompt the line cannot carry', async () => {
    const onPromptCarry = vi.fn()
    const result = await build(onPromptCarry)

    expect(result.startup.command).not.toContain('summarize')
    expect(result.followup).toBeUndefined()
    expect(onPromptCarry).toHaveBeenCalledWith(false)
  })

  it('carries a short-lined multi-line prompt on a local zsh line, as main typed it', async () => {
    const onPromptCarry = vi.fn()
    const result = await build(onPromptCarry, '/bin/zsh')

    expect(result.startup.command).toContain('summarize the diff\nthen list the risks')
    expect(onPromptCarry).toHaveBeenCalledWith(true)
  })

  it('keeps folding the prompt for a caller that delivers nothing afterwards', async () => {
    // `orca worktree create --prompt` has no post-start paste of its own for an argv agent.
    expect((await build()).startup.command).toContain('summarize the diff')
  })
})

describe('buildWorktreeStartupForDraft agent detection', () => {
  it('never probes this client for an SSH host named only by executionHostId', async () => {
    mocks.detectInstalledAgentsWithShellPathHydration.mockResolvedValue(['claude'])

    const result = await buildWorktreeStartupForDraft({
      repo: makeRepo({ executionHostId: 'ssh:openclaw' }),
      settings,
      draft: 'ship it',
      getLaunchRuntime: () => LINUX
    })

    expect(mocks.detectInstalledAgentsWithShellPathHydration).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('probes this client for a local row carrying a stale connection', async () => {
    mocks.detectInstalledAgentsWithShellPathHydration.mockResolvedValueOnce(['claude'])

    const result = await buildWorktreeStartupForDraft({
      repo: makeRepo({ connectionId: 'm4air', executionHostId: 'local' }),
      settings,
      draft: 'ship it',
      getLaunchRuntime: () => LINUX
    })

    expect(result?.agent).toBe('claude')
  })
})

describe('buildWorktreeStartupForAgent extra agent args', () => {
  it('refuses invalid extras before any terminal exists', async () => {
    await expect(
      buildWorktreeStartupForAgent({
        repo: makeRepo({}),
        settings,
        agent: 'claude',
        prompt: 'go',
        extraAgentArgs: '--settings evil.json',
        getLaunchRuntime: () => LINUX,
        toSessionOptions: () => undefined
      })
    ).rejects.toThrow('"--settings"')
  })

  it("merges a launch's account env over the startup plan's env", async () => {
    const build = vi.fn(() => ({
      agent: 'codex' as const,
      startup: { command: 'codex', env: { CODEX_HOME: '/stale', KEEP: '1' } },
      launchRuntime: LINUX_FACT
    }))
    const resolved = await resolveWorktreeCreateAgentStartup(
      {
        repoSelector: 'repo-1',
        name: 'Review',
        startupAgent: 'codex',
        startupAccountEnv: { CODEX_HOME: '/home/u/.codex-b' }
      },
      build
    )

    expect(resolved?.startup.env).toEqual({ CODEX_HOME: '/home/u/.codex-b', KEEP: '1' })
    expect(resolved?.launchRuntime).toBe(LINUX_FACT)
  })
})

describe('resolveWorktreeStartupDraftAgent', () => {
  beforeEach(() => {
    mocks.detectInstalledAgentsWithShellPathHydration.mockReset()
    mocks.detectInstalledAgentsWithShellPathHydration.mockResolvedValue([])
  })
  afterEach(() => {
    mocks.detectInstalledAgentsWithShellPathHydration.mockReset()
  })

  const resolve = (
    fields: Partial<Parameters<typeof resolveWorktreeStartupDraftAgent>[0]['settings']>,
    requestedAgent?: 'claude' | 'codex',
    repo = makeRepo({})
  ) =>
    resolveWorktreeStartupDraftAgent({
      repo,
      settings: { ...settings, ...fields },
      ...(requestedAgent ? { requestedAgent } : {})
    })

  // An unserved SSH host cannot be answered by local detection.
  it('starts no agent on an unserved SSH host rather than detecting locally', async () => {
    mocks.detectInstalledAgentsWithShellPathHydration.mockResolvedValue(['codex'])

    await expect(resolve({}, undefined, makeRepo({ connectionId: 'ssh-1' }))).resolves.toBeNull()
    expect(mocks.detectInstalledAgentsWithShellPathHydration).not.toHaveBeenCalled()
  })
})

describe('paired workspace draft inputs', () => {
  it.each(['claude', 'codex'] as const)(
    'applies picks and authored Arguments to a %s draft',
    async (agent) => {
      const result = await buildWorktreeStartupForDraft({
        repo: makeRepo({}),
        settings: { ...settings, agentDefaultArgs: { [agent]: '--add-dir /host/shared' } },
        draft: 'ship it',
        requestedAgent: agent,
        agentArgs: '',
        sessionOptions: { model: 'opus' },
        getLaunchRuntime: () => LINUX
      })
      expect(result?.startup.command).toContain(
        agent === 'codex' ? "'-m' 'opus'" : "'--model' 'opus'"
      )
      expect(result?.startup.command).not.toContain('/host/shared')
      if (agent === 'claude') {
        expect(result?.startup.command).toContain("'ship it'")
        expect(result?.draftPaste).toBeUndefined()
      } else {
        expect(result?.draftPaste).toEqual({ agent: 'codex', content: 'ship it' })
      }
    }
  )

  it('keeps the disabled-agent draft substitution without applying the original picks or Arguments', async () => {
    mocks.detectInstalledAgentsWithShellPathHydration.mockResolvedValue(['codex'])
    const result = await buildWorktreeStartupForDraft({
      repo: makeRepo({}),
      settings: {
        ...settings,
        disabledTuiAgents: ['claude'],
        agentDefaultArgs: { codex: '--model host-model' }
      },
      draft: 'ship it',
      requestedAgent: 'claude',
      agentArgs: '--add-dir /claude-only',
      sessionOptions: { model: 'opus' },
      getLaunchRuntime: () => LINUX
    })
    expect(result?.agent).toBe('codex')
    expect(result?.startup.command).toContain('host-model')
    expect(result?.startup.command).not.toContain('opus')
    expect(result?.startup.command).not.toContain('/claude-only')
    expect(result?.draftPaste).toEqual({ agent: 'codex', content: 'ship it' })
  })
})
