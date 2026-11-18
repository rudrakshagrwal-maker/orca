import { collectAgentPaneConversations } from '@/lib/agent-session/identity/pane-agent-conversations'
import { activateWorktreeAgentPane } from '../sidebar/workspace-card/activity/use-worktree-agent-activation'
import {
  LOCAL_EXECUTION_HOST_ID,
  parseRoutableExecutionHostId
} from '../../../../shared/execution-host'
import { useAppStore } from '@/store'
import type { AiVaultSearchHit } from '../../../../shared/ai-vault/search/ai-vault-search-types'
import {
  resolveAiVaultSessionLaunchTarget,
  aiVaultResumeUnsupportedMessage
} from '../right-sidebar/ai-vault/session-actions/ai-vault-session-launch-target'
import { prepareAiVaultTerminalResumeRequest } from '@/lib/agent-session/resume/history/ai-vault-session-resume-preparation'
import { buildAiVaultResumeStartupForWorktree } from '@/lib/agent-session/resume/history/ai-vault-resume-command'
import { launchAiVaultSessionAndReveal } from '@/lib/agent-session/resume/history/launch-ai-vault-session-and-reveal'

export async function resumeSearchHit(hit: AiVaultSearchHit): Promise<void> {
  if (!hit.source.filePath || hit.source.presence !== 'present') {
    throw new Error('This transcript is no longer available.')
  }
  const executionHostId =
    hit.executionHostId === undefined
      ? LOCAL_EXECUTION_HOST_ID
      : parseRoutableExecutionHostId(hit.executionHostId)?.id
  if (!executionHostId) {
    throw new Error('This chat belongs to an unavailable host.')
  }
  const state = useAppStore.getState()
  const existing = collectAgentPaneConversations(
    state,
    (agent): agent is 'claude' | 'codex' => agent === 'claude' || agent === 'codex',
    { runningAgentsOnly: true }
  ).find(
    (pane) =>
      pane.agent === hit.agent &&
      pane.executionHostId === executionHostId &&
      pane.providerSession.id === hit.sessionId
  )
  if (existing) {
    activateWorktreeAgentPane(existing.worktreeId, existing.tabId, existing.paneKey)
    return
  }
  const target = resolveAiVaultSessionLaunchTarget({
    sessionFilePath: hit.source.filePath,
    sessionExecutionHostId: executionHostId,
    activeWorktreeId: state.activeWorktreeId,
    targetState: state
  })
  if (target.status !== 'ready') {
    throw new Error(
      target.status === 'unsupported'
        ? aiVaultResumeUnsupportedMessage(target.targetStatus)
        : 'Open a workspace before resuming a chat.'
    )
  }
  const session = {
    agent: hit.agent,
    sessionId: hit.sessionId,
    cwd: hit.cwd,
    filePath: hit.source.filePath,
    codexHome: hit.source.codexHome ?? null,
    executionHostId
  }
  const prepared = await prepareAiVaultTerminalResumeRequest(session)
  const startup = buildAiVaultResumeStartupForWorktree({
    state: useAppStore.getState(),
    worktreeId: target.worktreeId,
    session: {
      ...session,
      codexHome: prepared.useRealCodexHome
        ? null
        : (prepared.substituteCodexHome ?? session.codexHome)
    },
    commandOverride: state.settings?.agentCmdOverrides?.[hit.agent]
  })
  await launchAiVaultSessionAndReveal({
    ...startup,
    agent: hit.agent,
    worktreeId: target.worktreeId
  })
}
