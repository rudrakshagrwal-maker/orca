import { backgroundJobsDisabled } from '../../../shared/fork-background-policy'
import { useTranslation } from 'react-i18next'
import { ModalBoundary, OverlayBoundary } from './app-root-surface-boundaries'
import { memo, Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/app-shell/startup/lazy-with-retry'
import { useTranslate } from '@/i18n/use-translate'
import { RecoverableRenderErrorBoundary } from '../components/error-boundaries/RecoverableRenderErrorBoundary'
import NewWorkspaceComposerModal from '../components/NewWorkspaceComposerModal'
import { CrashReportDialog } from '../components/crash-report/CrashReportDialog'
import { MarkdownTemplatePicker } from '../components/editor/markdown/documents/MarkdownTemplatePicker'
import RecentTabSwitcher from '../components/tab-bar/RecentTabSwitcher'
import { ZoomOverlay } from '../components/ZoomOverlay'
import { WslMoveDialogHost } from '../components/wsl-move/WslMoveDialog'
import { shouldRenderPetOverlay } from '../components/pet/pet-overlay-visibility'
import { useAppStore } from '../store/index'
import { useLazyModalMounts } from './use-lazy-modal-mounts'
import { usePreloadWorktreeJumpPalette, WorktreeJumpPalette } from './worktree-jump-palette-preload'
import {
  selectAppRootSurfacePetEnabled,
  selectAppRootSurfaceVoiceEnabled
} from './app-root-surface-settings'
import type { FloatingWorkspacePanelState } from './use-floating-workspace-panel'
import type { OnboardingGate } from './use-onboarding-and-feature-tips'

const QuickOpen = lazy(() => import('../components/QuickOpen'))
const WorkspaceCleanupDialog = lazy(
  () => import('../components/workspace-cleanup/WorkspaceCleanupDialog')
)
const StatusBar = lazy(() =>
  import('../components/status-bar/StatusBar').then((module) => ({ default: module.StatusBar }))
)
const AddRepoDialog = lazy(
  () => import('../components/sidebar/project-admission/dialog/AddRepoDialog')
)
const NonGitFolderDialog = lazy(
  () => import('../components/sidebar/project-admission/dialog/NonGitFolderDialog')
)
const AddProjectFromFolderDialog = lazy(
  () => import('../components/sidebar/project-admission/dialog/AddProjectFromFolderDialog')
)
const DiagramViewerModal = lazy(() => import('../components/editor/DiagramViewerModal'))
const ProjectAddedDialog = lazy(
  () => import('../components/sidebar/project-admission/completion/ProjectAddedDialog')
)
const NodeDistMirrorDialog = lazy(
  () => import('../components/ssh-host-recovery/NodeDistMirrorDialog')
)
const AiVaultSessionHistoryDialog = lazy(
  () => import('../components/right-sidebar/ai-vault/session-list/AiVaultSessionHistoryDialog')
)
const NativeChatAccountUsageDialog = lazy(
  () => import('../components/native-chat/usage/NativeChatAccountUsageDialog')
)
const DeleteWorktreeDialog = lazy(
  () => import('../components/sidebar/workspace-actions/deletion/DeleteWorktreeDialog')
)
const PreservedBranchBatchReviewModal = lazy(
  () => import('../components/sidebar/workspace-actions/deletion/PreservedBranchBatchReviewModal')
)
const DictationController = lazy(() =>
  import('../components/dictation/DictationController').then((module) => ({
    default: module.DictationController
  }))
)
const SshPassphraseDialog = lazy(() =>
  import('../components/ssh-authentication/SshPassphraseDialog').then((module) => ({
    default: module.SshPassphraseDialog
  }))
)
const RemoteServerUpdateDialog = lazy(
  () => import('../components/settings/runtime-environments/updates/RemoteServerUpdateDialog')
)
const FloatingTerminalPanel = lazy(() =>
  import('../components/floating-terminal/FloatingTerminalPanel').then((module) => ({
    default: module.FloatingTerminalPanel
  }))
)
// Load the pet asset/overlay only when enabled.
const PetOverlay = lazy(() => import('../components/pet/PetOverlay'))

/** Keep root overlays in stable sibling order; fetch gated chunks only when their surfaces can appear. Memoized so active-workspace App renders skip every root overlay. */
export const AppRootSurfaces = memo(function AppRootSurfaces(props: {
  floatingWorkspace: FloatingWorkspacePanelState
  onboardingGate: OnboardingGate
}): React.JSX.Element {
  const t = useTranslate()
  const { floatingWorkspace } = props
  // Memoized: subscribe so a language change still repaints its labels.
  useTranslation()
  const { mountedLazyModalIds, shouldMountAddRepoDialog } = useLazyModalMounts()
  usePreloadWorktreeJumpPalette()
  const activeView = useAppStore((s) => s.activeView)
  const activeModal = useAppStore((s) => s.activeModal)
  // Subscribe only to consumed settings so unrelated preferences cannot rerender every overlay.
  const voiceEnabled = useAppStore(selectAppRootSurfaceVoiceEnabled)
  const petEnabled = useAppStore(selectAppRootSurfacePetEnabled)
  // RA: legacy UI state cannot load usage/plugin status workers or voice/pet features.
  const statusBarVisible = useAppStore((s) => !backgroundJobsDisabled() && s.statusBarVisible)
  const persistedUIReady = useAppStore((s) => s.persistedUIReady)
  const petVisible = useAppStore((s) => s.petVisible)
  const dictationState = useAppStore((s) => s.dictationState)
  const hasSshCredentialRequest = useAppStore((s) => s.sshCredentialQueue.length > 0)

  const shouldMountDictationController = !backgroundJobsDisabled() && (voiceEnabled || dictationState !== 'idle')
  const renderPetOverlay = !backgroundJobsDisabled() && shouldRenderPetOverlay({ persistedUIReady, petEnabled, petVisible })

  return (
    <>
      {floatingWorkspace.shouldMountPanel ? (
        <Suspense fallback={null}>
          <OverlayBoundary
            boundaryId="overlay.floating-workspace"
            resetKey={floatingWorkspace.open}
            title={t('auto.App.1b3024bcd6', 'The floating workspace hit an error.')}
            description={t(
              'auto.App.7cbfbf622f',
              'Retry the floating workspace or close and reopen it.'
            )}
          >
            <FloatingTerminalPanel
              open={floatingWorkspace.open}
              onOpenChange={floatingWorkspace.setOpenWithFocus}
              tourInteractionSnapshot={floatingWorkspace.tourInteractionSnapshotRef.current}
            />
          </OverlayBoundary>
        </Suspense>
      ) : null}
      {statusBarVisible ? (
        <Suspense
          fallback={
            <div className="h-6 min-h-[24px] shrink-0 border-t border-border bg-[var(--bg-titlebar,var(--card))]" />
          }
        >
          <OverlayBoundary
            boundaryId="overlay.status-bar"
            resetKey={activeView}
            title={t('auto.App.2e8ff36f94', 'The status bar hit an error.')}
            description={t('auto.App.8a023cea1f', 'Retry the status bar to remount its controls.')}
          >
            <StatusBar floatingTerminalOpen={floatingWorkspace.open} />
          </OverlayBoundary>
        </Suspense>
      ) : null}
      {/* Keep Create in the entry bundle so a stale lazy chunk cannot strand users. */}
      {activeModal === 'new-workspace-composer' ? (
        <ModalBoundary boundaryId="modal.new-workspace-composer" resetKey>
          <NewWorkspaceComposerModal />
        </ModalBoundary>
      ) : null}
      <Suspense fallback={null}>
        {shouldMountAddRepoDialog ? (
          <ModalBoundary boundaryId="modal.add-repo" resetKey={activeModal === 'add-repo'}>
            <AddRepoDialog />
          </ModalBoundary>
        ) : null}
        {/* Settings can add projects without Sidebar; host its handoff dialogs here too. */}
        {activeModal === 'confirm-non-git-folder' ? (
          <ModalBoundary boundaryId="modal.confirm-non-git-folder" resetKey>
            <NonGitFolderDialog />
          </ModalBoundary>
        ) : null}
        {activeModal === 'confirm-add-project-from-folder' ? (
          <ModalBoundary boundaryId="modal.confirm-add-project-from-folder" resetKey>
            <AddProjectFromFolderDialog />
          </ModalBoundary>
        ) : null}
        {activeModal === 'project-added' ? (
          <ModalBoundary boundaryId="modal.project-added" resetKey>
            <ProjectAddedDialog />
          </ModalBoundary>
        ) : null}
        {/* Root hosting prevents chat capture handlers receiving /resume and /usage dialog events. */}
        {!backgroundJobsDisabled() && activeModal === 'agent-session-history' ? (
          <ModalBoundary boundaryId="modal.agent-session-history" resetKey>
            <AiVaultSessionHistoryDialog />
          </ModalBoundary>
        ) : null}
        {!backgroundJobsDisabled() && activeModal === 'chat-account-usage' ? (
          <ModalBoundary boundaryId="modal.chat-account-usage" resetKey>
            <NativeChatAccountUsageDialog />
          </ModalBoundary>
        ) : null}
        {/* Own store, not activeModal: another modal must never evict a running move. */}
        <WslMoveDialogHost />
        {/* Opened by toast, SSH host row and terminal pane. */}
        {activeModal === 'node-dist-mirror' ? (
          <ModalBoundary boundaryId="modal.node-dist-mirror" resetKey>
            <NodeDistMirrorDialog />
          </ModalBoundary>
        ) : null}
        {/* The viewer must outlive the virtualized chat row that opened it. */}
        {activeModal === 'diagram-viewer' ? (
          <ModalBoundary boundaryId="modal.diagram-viewer" resetKey>
            <DiagramViewerModal />
          </ModalBoundary>
        ) : null}
      </Suspense>
      {/* Keep lazy root surfaces under the shared Radix Tooltip provider. */}
      <Suspense fallback={null}>
        {mountedLazyModalIds.has('workspace-cleanup') ? (
          <ModalBoundary
            boundaryId="modal.workspace-cleanup"
            resetKey={activeModal === 'workspace-cleanup'}
          >
            <WorkspaceCleanupDialog />
          </ModalBoundary>
        ) : null}
      </Suspense>
      <Suspense fallback={null}>
        {mountedLazyModalIds.has('quick-open') ? (
          <ModalBoundary boundaryId="modal.quick-open" resetKey={activeModal === 'quick-open'}>
            <QuickOpen />
          </ModalBoundary>
        ) : null}
        {mountedLazyModalIds.has('worktree-palette') ? (
          <ModalBoundary
            boundaryId="modal.worktree-palette"
            resetKey={activeModal === 'worktree-palette'}
          >
            <WorktreeJumpPalette />
          </ModalBoundary>
        ) : null}
      </Suspense>
      {/* RA: no automatic setup observer or contextual tour overlay. */}
      {/* Wait for UI hydration so default visibility cannot flash a saved-hidden pet. */}
      {renderPetOverlay ? (
        <Suspense fallback={null}>
          <OverlayBoundary boundaryId="overlay.pet" resetKey={petVisible}>
            <PetOverlay />
          </OverlayBoundary>
        </Suspense>
      ) : null}
      {/* RA: no notification cards, restart offers, star nags or telemetry consent surfaces. */}
      <OverlayBoundary boundaryId="overlay.zoom" resetKey={activeView}>
        <ZoomOverlay />
      </OverlayBoundary>
      <Suspense fallback={null}>
        {activeModal === 'delete-worktree' ? (
          <ModalBoundary boundaryId="modal.delete-worktree" resetKey>
            <DeleteWorktreeDialog />
          </ModalBoundary>
        ) : null}
        {activeModal === 'preserved-branch-review' ? (
          <ModalBoundary boundaryId="modal.preserved-branch-review" resetKey>
            <PreservedBranchBatchReviewModal />
          </ModalBoundary>
        ) : null}
      </Suspense>
      {hasSshCredentialRequest ? (
        <Suspense fallback={null}>
          <ModalBoundary boundaryId="modal.ssh-passphrase" resetKey={activeModal}>
            <SshPassphraseDialog />
          </ModalBoundary>
        </Suspense>
      ) : null}
      <ModalBoundary boundaryId="modal.markdown-template-picker" resetKey={activeModal}>
        <MarkdownTemplatePicker />
      </ModalBoundary>
      <RecoverableRenderErrorBoundary
        boundaryId="modal.crash-report"
        surface="modal"
        reportAsCrash={false}
        resetKey={activeModal}
        compact
        title={t('auto.App.722d03aa62', 'The crash report dialog hit an error.')}
        description={t(
          'auto.App.acd66311dc',
          'Use the Help menu after retrying if you still need diagnostics.'
        )}
      >
        <CrashReportDialog />
      </RecoverableRenderErrorBoundary>
      {/* RA: onboarding wizard is never mounted. */}
      {shouldMountDictationController ? (
        <Suspense fallback={null}>
          <OverlayBoundary boundaryId="overlay.dictation" resetKey={activeView}>
            <DictationController />
          </OverlayBoundary>
        </Suspense>
      ) : null}
      <OverlayBoundary boundaryId="overlay.recent-tab-switcher" resetKey={activeView}>
        <RecentTabSwitcher />
      </OverlayBoundary>
      {/* RA: no skill-freshness dialog can be opened by leftover request publishers. */}
      <Suspense fallback={null}>
        <OverlayBoundary boundaryId="overlay.remote-server-update-dialog">
          <RemoteServerUpdateDialog />
        </OverlayBoundary>
      </Suspense>
    </>
  )
})
