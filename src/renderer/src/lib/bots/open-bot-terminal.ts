import { useAppStore } from '@/store'
import { selectWorkspaceByHostTarget } from '@/store/workspaces/selection/workspace-host-target'
import { getActiveSidebarWorkspaceId } from '../../../../shared/workspace-scope'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { getConnectionIdFromState } from '@/lib/workspace/ownership/connection-owner-resolution'
import { isWslUncPath } from '../../../../shared/wsl-paths'
import { hostWorktreeTarget } from '../../../../shared/worktree/host-qualified-identity'
import { launchAgentInNewTabWithOutcome } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { settleAgentTabLaunch } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab-host-agents'
import { createNonSecureContextUuid } from '../../../../shared/non-secure-context-uuid'
import type { BotProfile } from '../../../../shared/bot-profile-types'

const opening = new Set<string>()
export async function openBotTerminal(
  profile: BotProfile,
  sessionId?: string | null
): Promise<void> {
  if (opening.has(profile.key)) {
    return
  }
  opening.add(profile.key)
  try {
    if (!window.api.bots) {
      throw new Error('Bots require the local desktop')
    }
    const state = useAppStore.getState()
    const active = getActiveSidebarWorkspaceId(state.activeWorkspaceKey, state.activeWorktreeId)
    const hostId = state.activeWorkspaceExecutionHostId ?? LOCAL_EXECUTION_HOST_ID
    const target = active ? hostWorktreeTarget({ id: active, hostId }) : null
    const workspace = target ? selectWorkspaceByHostTarget(state, target) : undefined
    if (!workspace) {
      throw new Error('Open a local workspace to start a bot chat.')
    }
    if (
      hostId !== LOCAL_EXECUTION_HOST_ID ||
      getConnectionIdFromState(state, workspace.id) ||
      isWslUncPath(workspace.path)
    ) {
      throw new Error('Select a local workspace to use local Hermes bots.')
    }
    const launch = await window.api.bots.launch(profile.key, sessionId)
    const current = useAppStore.getState()
    if (!target || !selectWorkspaceByHostTarget(current, target)) {
      throw new Error('The workspace was removed before launch.')
    }
    const outcome = launchAgentInNewTabWithOutcome(
      {
        requestId: createNonSecureContextUuid(),
        agent: 'hermes',
        worktreeId: workspace.id,
        workspaceExecutionHostId: LOCAL_EXECUTION_HOST_ID,
        selectedExecutionHostId: LOCAL_EXECUTION_HOST_ID,
        requestedSurface: 'terminal',
        initialCwd: workspace.path,
        agentArgs: launch.agentArgs,
        actionAgentArgs: launch.agentArgs,
        quickCommandLabel: launch.label,
        groupId: current.activeGroupIdByWorktree[workspace.id]
      },
      false
    )
    if (!outcome || 'refused' in outcome) {
      throw new Error('Could not launch Hermes. Check the Hermes agent settings.')
    }
    const settled = await settleAgentTabLaunch(outcome)
    if (settled.kind !== 'terminal') {
      throw new Error('Could not launch Hermes. Check the Hermes agent settings.')
    }
  } finally {
    opening.delete(profile.key)
  }
}
