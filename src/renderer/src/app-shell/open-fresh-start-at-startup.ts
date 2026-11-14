import { useAppStore } from '../store'
import { getActiveSidebarWorkspaceId } from '../../../shared/workspace-scope'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import { hostWorktreeTarget } from '../../../shared/worktree/host-qualified-identity'
import { createNonSecureContextUuid } from '../../../shared/non-secure-context-uuid'
import { selectWorkspaceByHostTarget } from '@/store/workspaces/selection/workspace-host-target'
import { launchAgentInNewTabWithOutcome } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { settleAgentTabLaunch } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab-host-agents'
import { activateAndRevealWorkspaceWithOutcome } from '@/lib/workspace/activation/worktree-activation'
import { openWorkspaceAtStartup } from './open-workspace-at-startup'
import type { WorkspaceSessionState } from '../../../shared/workspace-session/workspace-session-state-types'

type StartupSelection = Pick<
  WorkspaceSessionState,
  'activeWorktreeId' | 'activeWorkspaceKey' | 'activeWorkspaceExecutionHostId'
>

export async function openWorkspaceForAppLaunch(
  isCancelled: () => boolean,
  worktreeRefresh: Promise<unknown>,
  savedSelection: StartupSelection
): Promise<void> {
  if (isCancelled()) {
    return
  }
  const freshStart = await window.api.session.claimFreshStart(false)
  if (isCancelled()) {
    return
  }
  if (freshStart) {
    await worktreeRefresh
    await openFreshStartAtStartup(isCancelled, savedSelection)
  } else {
    await openWorkspaceAtStartup(isCancelled)
  }
}

export async function openFreshStartAtStartup(
  isCancelled: () => boolean,
  savedSelection: StartupSelection = useAppStore.getState()
): Promise<void> {
  if (isCancelled()) {
    return
  }
  const state = useAppStore.getState()
  const activeId = getActiveSidebarWorkspaceId(
    savedSelection.activeWorkspaceKey,
    savedSelection.activeWorktreeId
  )
  let hostId = savedSelection.activeWorkspaceExecutionHostId ?? LOCAL_EXECUTION_HOST_ID
  let workspace = activeId
    ? selectWorkspaceByHostTarget(state, hostWorktreeTarget({ id: activeId, hostId }))
    : undefined
  if (!workspace) {
    const repo = state.repos[0]
    if (!repo) {
      return
    }
    hostId = getRepoExecutionHostId(repo)
    await state.fetchWorktrees(repo.id, { executionHostId: hostId })
    if (isCancelled()) {
      return
    }
    workspace = useAppStore
      .getState()
      .worktreesByRepo[repo.id]?.find(
        (worktree) => worktree.isMainWorktree && (worktree.hostId ?? hostId) === hostId
      )
  }
  if (!workspace || isCancelled()) {
    return
  }
  const claimed = await window.api.session.claimFreshStart()
  if (!claimed || isCancelled()) {
    return
  }
  const id = workspace.id
  const activation = activateAndRevealWorkspaceWithOutcome(id, {
    executionHostId: hostId,
    providesInitialSurface: true
  })
  if (!('opened' in activation)) {
    throw new Error('Could not open the fresh-start workspace')
  }
  const outcome = launchAgentInNewTabWithOutcome({
    requestId: createNonSecureContextUuid(),
    agent: 'claude',
    requestedSurface: 'terminal',
    worktreeId: id,
    workspaceExecutionHostId: hostId,
    selectedExecutionHostId: hostId,
    initialCwd: workspace.path,
    pendingActivationSpawn: true
  })
  if ((await settleAgentTabLaunch(outcome)).kind !== 'terminal') {
    throw new Error('Could not launch Claude for fresh start')
  }
}
