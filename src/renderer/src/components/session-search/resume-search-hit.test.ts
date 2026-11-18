import { beforeEach, expect, it, vi } from 'vitest'
import type { AiVaultSearchHit } from '../../../../shared/ai-vault/search/ai-vault-search-types'
import { resumeSearchHit } from './resume-search-hit'

const calls = vi.hoisted(() => ({
  conversations: vi.fn(),
  focus: vi.fn(),
  prepare: vi.fn(),
  startup: vi.fn(),
  launch: vi.fn(),
  target: vi.fn(),
  state: { activeWorktreeId: 'workspace', settings: {} }
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => calls.state } }))
vi.mock('@/lib/agent-session/identity/pane-agent-conversations', () => ({
  collectAgentPaneConversations: calls.conversations
}))
vi.mock('../sidebar/workspace-card/activity/use-worktree-agent-activation', () => ({
  activateWorktreeAgentPane: calls.focus
}))
vi.mock('../right-sidebar/ai-vault/session-actions/ai-vault-session-launch-target', () => ({
  resolveAiVaultSessionLaunchTarget: calls.target,
  aiVaultResumeUnsupportedMessage: () => 'Host mismatch'
}))
vi.mock('@/lib/agent-session/resume/history/ai-vault-session-resume-preparation', () => ({
  prepareAiVaultTerminalResumeRequest: calls.prepare
}))
vi.mock('@/lib/agent-session/resume/history/ai-vault-resume-command', () => ({
  buildAiVaultResumeStartupForWorktree: calls.startup
}))
vi.mock('@/lib/agent-session/resume/history/launch-ai-vault-session-and-reveal', () => ({
  launchAiVaultSessionAndReveal: calls.launch
}))

const hit: AiVaultSearchHit = {
  agent: 'claude',
  sessionId: 'conversation',
  title: 'Chat',
  cwd: '/project',
  branch: null,
  updatedAt: null,
  messageCount: 2,
  score: 1,
  source: { presence: 'present', filePath: '/history/conversation.jsonl' },
  evidence: null
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.conversations.mockReturnValue([])
  calls.target.mockReturnValue({ status: 'ready', worktreeId: 'workspace' })
  calls.prepare.mockResolvedValue({ useRealCodexHome: false })
  calls.startup.mockReturnValue({ command: 'claude --resume conversation' })
})

it('focuses the matching live terminal instead of launching a duplicate', async () => {
  calls.conversations.mockReturnValue([
    {
      agent: 'claude',
      executionHostId: 'local',
      providerSession: { id: 'conversation' },
      worktreeId: 'owner',
      tabId: 'tab',
      paneKey: 'pane'
    }
  ])
  await resumeSearchHit(hit)
  expect(calls.focus).toHaveBeenCalledWith('owner', 'tab', 'pane')
  expect(calls.launch).not.toHaveBeenCalled()
})

it('prepares and resumes a saved chat through the existing terminal launch path', async () => {
  await resumeSearchHit(hit)
  expect(calls.prepare).toHaveBeenCalledWith(
    expect.objectContaining({
      agent: 'claude',
      sessionId: 'conversation',
      filePath: '/history/conversation.jsonl',
      executionHostId: 'local'
    })
  )
  expect(calls.launch).toHaveBeenCalledWith({
    agent: 'claude',
    worktreeId: 'workspace',
    command: 'claude --resume conversation'
  })
})
