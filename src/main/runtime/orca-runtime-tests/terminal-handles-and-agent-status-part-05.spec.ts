import { describe, expect, it, vi } from 'vitest'
import './runtime-test-module-registration.spec'
import { AGENT_STATUS_STALE_AFTER_MS } from '../../../shared/agent-status/contracts/agent-status-freshness'
import { OrcaRuntimeService } from '../orca-runtime'
import { makePaneKey } from '../../../shared/workspace-layout/stable-pane-id'
import '../orca-runtime-test-mocks/setup.spec'
import { HEADLESS_LEAF_ID, TEST_WORKTREE_ID, store } from './orca-runtime-test-fixtures.spec'

describe('OrcaRuntimeService', () => {
  it('publishes hook-only identity for a pane that never emitted an agent title', async () => {
    // Hook-only agents can have no launchAgent or OSC status; do not gate their hook read on either.
    const paneKey = makePaneKey('quiet-tab', HEADLESS_LEAF_ID)
    const providerSession = {
      key: 'session_id' as const,
      id: 'b91c7e40-5a2d-4f19-9c33-2a7b6e5d4c88',
      transcriptPath: '/transcripts/b91c7e40.jsonl'
    }
    const runtime = new OrcaRuntimeService(store, undefined, {
      getAgentStatusSnapshot: () => [
        {
          paneKey,
          state: 'done',
          prompt: 'Hi',
          agentType: 'claude',
          connectionId: null,
          receivedAt: Date.now(),
          stateStartedAt: Date.now(),
          tabId: 'quiet-tab',
          worktreeId: TEST_WORKTREE_ID,
          providerSession
        }
      ]
    })
    runtime.setPtyController({
      spawn: vi.fn().mockResolvedValue({ id: 'pty-quiet' }),
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })
    await runtime.createTerminal(`id:${TEST_WORKTREE_ID}`, {
      tabId: 'quiet-tab',
      leafId: HEADLESS_LEAF_ID,
      title: 'Terminal'
    })

    const result = await runtime.listMobileSessionTabs(`id:${TEST_WORKTREE_ID}`)

    expect(result.tabs[0]).toEqual(
      expect.objectContaining({
        type: 'terminal',
        agentStatus: expect.objectContaining({ agentType: 'claude', providerSession })
      })
    )
  })

  it('reads a resume-identity-only row the live-agent snapshot filters out', async () => {
    // Pi session-only rows are excluded from running status but still carry the transcript native chat needs.
    const paneKey = makePaneKey('pi-tab', HEADLESS_LEAF_ID)
    const providerSession = {
      key: 'session_id' as const,
      id: '/sessions/pi-1.json',
      transcriptPath: '/sessions/pi-1.json'
    }
    const now = Date.now()
    const runtime = new OrcaRuntimeService(store, undefined, {
      getAgentProviderSessionSnapshot: () => [
        {
          paneKey,
          state: 'done',
          prompt: '',
          agentType: 'pi',
          connectionId: null,
          receivedAt: now + 1,
          stateStartedAt: now + 1,
          tabId: 'pi-tab',
          worktreeId: TEST_WORKTREE_ID,
          providerSession,
          providerSessionOnly: true
        }
      ]
    })
    runtime.setPtyController({
      spawn: vi.fn().mockResolvedValue({ id: 'pty-pi' }),
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })
    await runtime.createTerminal(`id:${TEST_WORKTREE_ID}`, {
      tabId: 'pi-tab',
      leafId: HEADLESS_LEAF_ID,
      title: 'Terminal'
    })

    const result = await runtime.listMobileSessionTabs(`id:${TEST_WORKTREE_ID}`)

    expect(result.tabs[0]).toEqual(
      expect.objectContaining({
        type: 'terminal',
        agentStatus: expect.objectContaining({ agentType: 'pi', providerSession })
      })
    )
  })

  it('does not let stale Pi resume metadata claim a plain terminal', async () => {
    const paneKey = makePaneKey('stale-pi-tab', HEADLESS_LEAF_ID)
    const runtime = new OrcaRuntimeService(store, undefined, {
      getAgentProviderSessionSnapshot: () => [
        {
          paneKey,
          state: 'done',
          prompt: '',
          agentType: 'pi',
          connectionId: null,
          receivedAt: Date.now() - AGENT_STATUS_STALE_AFTER_MS - 1,
          stateStartedAt: Date.now() - AGENT_STATUS_STALE_AFTER_MS - 1,
          tabId: 'stale-pi-tab',
          worktreeId: TEST_WORKTREE_ID,
          providerSession: {
            key: 'session_id',
            id: '/sessions/stale-pi.json',
            transcriptPath: '/sessions/stale-pi.json'
          },
          providerSessionOnly: true
        }
      ]
    })
    runtime.setPtyController({
      spawn: vi.fn().mockResolvedValue({ id: 'pty-stale-pi' }),
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })
    await runtime.createTerminal(`id:${TEST_WORKTREE_ID}`, {
      tabId: 'stale-pi-tab',
      leafId: HEADLESS_LEAF_ID,
      title: 'Terminal'
    })

    const result = await runtime.listMobileSessionTabs(`id:${TEST_WORKTREE_ID}`)

    expect(result.tabs[0]).toEqual(
      expect.objectContaining({
        type: 'terminal',
        agentStatus: expect.not.objectContaining({ agentType: 'pi' })
      })
    )
  })

  it('does not claim a stale hook agent owns a pane whose agent has since exited', async () => {
    // Retained status must not offer native chat for an agent that exited to its shell.
    const paneKey = makePaneKey('exited-tab', HEADLESS_LEAF_ID)
    const staleReceivedAt = Date.now() - AGENT_STATUS_STALE_AFTER_MS - 1_000
    const runtime = new OrcaRuntimeService(store, undefined, {
      getAgentStatusSnapshot: () => [
        {
          paneKey,
          state: 'done',
          prompt: 'Hi',
          agentType: 'claude',
          connectionId: null,
          receivedAt: staleReceivedAt,
          stateStartedAt: staleReceivedAt,
          tabId: 'exited-tab',
          worktreeId: TEST_WORKTREE_ID,
          providerSession: {
            key: 'session_id' as const,
            id: 'd4c3b2a1-0000-4000-8000-000000000001',
            transcriptPath: '/transcripts/d4c3b2a1.jsonl'
          }
        }
      ]
    })
    runtime.setPtyController({
      spawn: vi.fn().mockResolvedValue({ id: 'pty-exited' }),
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null
    })
    await runtime.createTerminal(`id:${TEST_WORKTREE_ID}`, {
      tabId: 'exited-tab',
      leafId: HEADLESS_LEAF_ID,
      title: 'Terminal'
    })

    runtime.onPtyData('pty-exited', '\x1b]0;✳ Claude Code\x07', 123)
    await new Promise<void>((resolve) => setImmediate(resolve))

    const result = await runtime.listMobileSessionTabs(`id:${TEST_WORKTREE_ID}`)

    const tab = result.tabs[0]
    expect(tab?.type).toBe('terminal')
    const agentStatus = tab && 'agentStatus' in tab ? tab.agentStatus : null
    expect(agentStatus?.agentType ?? null).toBeNull()
  })



})
