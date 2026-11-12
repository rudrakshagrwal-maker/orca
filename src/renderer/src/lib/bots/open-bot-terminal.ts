// RA: One click creates one ordinary tab through the existing layout/startup owner.
import { useAppStore } from '@/store'
import { selectWorkspaceByHostTarget } from '@/store/workspaces/selection/workspace-host-target'
import { getActiveSidebarWorkspaceId, folderWorkspaceKey } from '../../../../shared/workspace-scope'
import { LOCAL_EXECUTION_HOST_ID, getRepoExecutionHostId } from '../../../../shared/execution-host'
import { getConnectionIdFromState } from '@/lib/workspace/ownership/connection-owner-resolution'
import { activateAndRevealWorkspace } from '@/lib/workspace/activation/worktree-activation'
import type { BotProfile } from '../../../../shared/bot-profile-types'
import { hostWorktreeTarget } from '../../../../shared/worktree/host-qualified-identity'

const opening = new Set<string>()
export async function openBotTerminal(profile: BotProfile): Promise<void> {
  if (opening.has(profile.key)) return
  opening.add(profile.key)
  try {
    if (!window.api.bots) throw new Error('Bots require the local desktop')
    const state = useAppStore.getState()
    const active = getActiveSidebarWorkspaceId(state.activeWorkspaceKey, state.activeWorktreeId)
    let workspace = active ? selectWorkspaceByHostTarget(state, hostWorktreeTarget({ id: active, hostId: state.activeWorkspaceExecutionHostId ?? LOCAL_EXECUTION_HOST_ID })) : undefined
    if (!workspace || (state.activeWorkspaceExecutionHostId ?? LOCAL_EXECUTION_HOST_ID) !== LOCAL_EXECUTION_HOST_ID || getConnectionIdFromState(state, workspace.id) || !/^[A-Za-z]:[\\/]/.test(workspace.path)) {
      const repo = state.repos.find((r) => getRepoExecutionHostId(r) === LOCAL_EXECUTION_HOST_ID && r.path.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase() === 'c:/users/rudraksh/documents/workspace')
      workspace = repo ? state.worktreesByRepo[repo.id]?.find((w) => w.isMainWorktree && (w.hostId ?? LOCAL_EXECUTION_HOST_ID) === LOCAL_EXECUTION_HOST_ID) : undefined
      if (!workspace) { // RA: Workspace may be a native folder workspace, without a Git repo row.
        for (const folder of state.folderWorkspaces) {
          if (folder.folderPath.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase() !== 'c:/users/rudraksh/documents/workspace') continue
          workspace = selectWorkspaceByHostTarget(state, hostWorktreeTarget({ id: folderWorkspaceKey(folder.id), hostId: LOCAL_EXECUTION_HOST_ID }))
          if (workspace) break
        }
      }
    }
    if (!workspace) throw new Error('Open the local Workspace before launching a bot')
    const launch = await window.api.bots.launch(profile.key)
    const current = useAppStore.getState()
    if (!selectWorkspaceByHostTarget(current, hostWorktreeTarget({ id: workspace.id, hostId: LOCAL_EXECUTION_HOST_ID }))) throw new Error('The local workspace was removed before launch') // RA: revalidate after IPC.
    const tab = current.createTab(workspace.id, undefined, launch.shell, {
      startupCwd: workspace.path, forceHostRuntime: true,
      quickCommandLabel: launch.label,
      botProfile: launch.identity, // RA: cold restore retains only this identity.
      pendingStartup: { command: launch.command, env: launch.env }
    })
    current.setTabCustomTitle(tab.id, launch.label)
    activateAndRevealWorkspace(workspace.id, { executionHostId: LOCAL_EXECUTION_HOST_ID, providesInitialSurface: true })
  } finally { opening.delete(profile.key) }
}
