// RA: cards have no task-provider, automation or port subscriptions.
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { DEFAULT_AGENT_ACTIVITY_DISPLAY_MODE } from '../../../../../../shared/constants'
import { getWorktreeCardDetails } from '../../../../../../shared/worktree/card-properties'
import {
  isRuntimeOwnedSshTargetId,
  parseExecutionHostId,
  toRuntimeExecutionHostId
} from '../../../../../../shared/execution-host'
import { getHostDisplayLabelOverrides } from '../../../../../../shared/host-setting-overrides'

import { runtimeEnvironmentIdUnlessTwin } from '@/lib/workspace/ownership/resolve-owner'
import { hydrateRuntimeEnvironmentSshState } from '@/runtime/hosts/ssh/runtime-environment-ssh-state'
import { useRuntimeHostDisconnected } from '@/store/slices/runtime-status/views/use-runtime-status-view'
import { useAppStore } from '@/store'
import {
  selectRuntimeAwareSshStatus,
  selectRuntimeAwareSshTargetLabel,
  selectRuntimeAwareSshTargetRemoved
} from '@/store/slices/ssh/runtime-environment-ssh-selectors'
import type { WorktreeCardProps } from './worktree-card-model'
import { getDeleteStateForWorktreeHost } from '../../workspace-actions/deletion/worktree-delete-state-host-match'

export function useWorktreeCardFoundation({
  worktree,
  repo
}: Pick<WorktreeCardProps, 'worktree' | 'repo'>) {
  const openModal = useAppStore((s) => s.openModal)

  const updateWorktreeMeta = useAppStore((s) => s.updateWorktreeMeta)
  const setWorkspaceUnreadByUser = useAppStore((s) => s.setWorkspaceUnreadByUser)
  const deleteFolderWorkspace = useAppStore((s) => s.deleteFolderWorkspace)
  const setActiveWorktree = useAppStore((s) => s.setActiveWorktree)
  const renamingWorktreeId = useAppStore((s) => s.renamingWorktreeId)
  const setRenamingWorktreeId = useAppStore((s) => s.setRenamingWorktreeId)

  const settings = useAppStore((s) => s.settings)

  const cardProps = useAppStore((s) => s.worktreeCardProperties)
  const agentActivityDisplayMode =
    useAppStore((s) => s.agentActivityDisplayMode) ?? DEFAULT_AGENT_ACTIVITY_DISPLAY_MODE
  const projectGroups = useAppStore((s) => s.projectGroups)
  const newCardStyle = settings?.experimentalNewWorktreeCardStyle === true
  const compactWorktreeCards = settings?.compactWorktreeCards === true
  const cardDetails = useMemo(
    () => getWorktreeCardDetails(cardProps, { compactWorktreeCards, newCardStyle }),
    [cardProps, compactWorktreeCards, newCardStyle]
  )
  const { compactCards } = cardDetails
  const handleEditIssue = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      openModal('edit-meta', {
        worktreeId: worktree.id,
        // Qualify the owner because the same workspace ID may exist on multiple hosts.
        repoId: worktree.repoId,
        executionHostId: worktree.hostId,
        currentDisplayName: worktree.displayName,
        currentIssue: worktree.linkedIssue,
        currentPR: worktree.linkedPR,
        currentComment: worktree.comment,
        focus: 'issue'
      })
    },
    [worktree, openModal]
  )

  const handleManageLinks = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      openModal('edit-meta', {
        worktreeId: worktree.id,
        repoId: worktree.repoId,
        executionHostId: worktree.hostId,
        currentDisplayName: worktree.displayName,
        currentComment: worktree.comment,
        focus: 'links'
      })
    },
    [worktree, openModal]
  )

  const handleEditComment = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      openModal('edit-meta', {
        worktreeId: worktree.id,
        repoId: worktree.repoId,
        executionHostId: worktree.hostId,
        currentDisplayName: worktree.displayName,
        currentIssue: worktree.linkedIssue,
        currentPR: worktree.linkedPR,
        currentComment: worktree.comment,
        focus: 'comment'
      })
    },
    [worktree, openModal]
  )

  const deleteState = useAppStore((s) => {
    return getDeleteStateForWorktreeHost(worktree, s.deleteStateByWorktreeId)
  })
  const conflictOperation = useAppStore((s) => s.gitConflictOperationByWorktree[worktree.id])
  const remoteBranchConflict = useAppStore((s) => s.remoteBranchConflictByWorktreeId[worktree.id])

  // Avoid per-card host-qualified scans; twins use direct SSH status for this status-only chip.
  const sshOwnerEnvironmentId = useAppStore((s) =>
    repo?.connectionId ? runtimeEnvironmentIdUnlessTwin(s, worktree.id) : null
  )
  const sshStatus = useAppStore((s) => {
    // Why: runtime-owned SSH targets suppress their ssh:state-changed broadcasts, so don't show a false "disconnected" chip for them.
    if (!repo?.connectionId || isRuntimeOwnedSshTargetId(repo.connectionId)) {
      return null
    }
    return selectRuntimeAwareSshStatus(s, sshOwnerEnvironmentId, repo.connectionId)
  })
  useEffect(() => {
    if (sshOwnerEnvironmentId) {
      void hydrateRuntimeEnvironmentSshState(sshOwnerEnvironmentId).catch(() => {})
    }
  }, [sshOwnerEnvironmentId])
  const isSshDisconnected = sshStatus != null && sshStatus !== 'connected'
  // Require positive removal evidence; runtime-owned targets are absent from listTargets by design.
  const sshTargetRemoved = useAppStore((s) =>
    repo?.connectionId && !isRuntimeOwnedSshTargetId(repo.connectionId)
      ? selectRuntimeAwareSshTargetRemoved(s, sshOwnerEnvironmentId, repo.connectionId)
      : false
  )

  const parsedRepoHost = parseExecutionHostId(repo?.executionHostId)
  const runtimeOwnerEnvironmentId =
    worktree.runtimeOwnerEnvironmentId ??
    (parsedRepoHost?.kind === 'runtime' ? parsedRepoHost.environmentId : null)
  const runtimeHostId = runtimeOwnerEnvironmentId
    ? toRuntimeExecutionHostId(runtimeOwnerEnvironmentId)
    : null
  const runtimeEnvironmentName = useAppStore((s) =>
    runtimeOwnerEnvironmentId
      ? (s.runtimeEnvironments.find((environment) => environment.id === runtimeOwnerEnvironmentId)
          ?.name ?? null)
      : null
  )
  const runtimeHostLabel = runtimeHostId
    ? (getHostDisplayLabelOverrides(settings).get(runtimeHostId) ?? runtimeEnvironmentName)
    : null
  // Missing runtime probe data means unknown, not disconnected.
  const isRuntimeDisconnected = useRuntimeHostDisconnected(runtimeOwnerEnvironmentId || null)
  const [titleRenaming, setTitleRenaming] = useState(false)
  const [showRenameErrorDialog, setShowRenameErrorDialog] = useState(false)
  // Why: read the target label from its owning host's store instead of exposing HUB-private SSH metadata as client-local state.
  const sshTargetLabel = useAppStore((s) =>
    repo?.connectionId
      ? selectRuntimeAwareSshTargetLabel(s, sshOwnerEnvironmentId, repo.connectionId)
      : ''
  )

  return {
    openModal,
    updateWorktreeMeta,
    setWorkspaceUnreadByUser,
    deleteFolderWorkspace,
    setActiveWorktree,
    renamingWorktreeId,
    setRenamingWorktreeId,
    settings,
    cardProps,
    agentActivityDisplayMode,
    projectGroups,
    newCardStyle,
    compactCards,
    cardDetails,
    handleEditIssue,
    handleManageLinks,
    handleEditComment,
    deleteState,
    conflictOperation,
    remoteBranchConflict,
    sshOwnerEnvironmentId,
    sshStatus,
    isSshDisconnected,
    sshTargetRemoved,
    parsedRepoHost,
    runtimeHostLabel,
    isRuntimeDisconnected,
    titleRenaming,
    setTitleRenaming,
    showRenameErrorDialog,
    setShowRenameErrorDialog,
    sshTargetLabel
  }
}
