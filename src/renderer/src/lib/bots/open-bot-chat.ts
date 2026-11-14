import { useAppStore } from '@/store'
import { getActiveSidebarWorkspaceId } from '../../../../shared/workspace-scope'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { createNonSecureContextUuid } from '../../../../shared/non-secure-context-uuid'
import type { BotProfile } from '../../../../shared/bot-profile-types'

export async function openBotChat(profile: BotProfile, sessionId?: string | null): Promise<void> {
  const state = useAppStore.getState()
  const workspaceId = getActiveSidebarWorkspaceId(state.activeWorkspaceKey, state.activeWorktreeId)
  if (
    !workspaceId ||
    (state.activeWorkspaceExecutionHostId ?? LOCAL_EXECUTION_HOST_ID) !== LOCAL_EXECUTION_HOST_ID
  ) {
    throw new Error('Select a local Orca workspace to open a bot chat.')
  }
  if (!window.api.bots) {
    throw new Error('Bots require the desktop app')
  }
  const result = await window.api.bots.open({
    botId: profile.key,
    sessionId,
    worktree: `id:${workspaceId}`,
    requestId: createNonSecureContextUuid()
  })
  const { openStructuredAgentSessionProvisionalTab } =
    await import('@/lib/agent-session/launch/structured-agent-session-launch-surface')
  openStructuredAgentSessionProvisionalTab({
    sessionId: result.sessionId,
    worktreeId: result.worktreeId,
    executionHostId: LOCAL_EXECUTION_HOST_ID,
    agent: 'hermes',
    targetGroupId: state.activeGroupIdByWorktree[result.worktreeId]
  })
}
