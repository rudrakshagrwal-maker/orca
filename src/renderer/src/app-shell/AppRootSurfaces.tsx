import { useTranslation } from 'react-i18next'
import { ModalBoundary, OverlayBoundary } from './app-root-surface-boundaries'
import { memo, Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/app-shell/startup/lazy-with-retry'
import { useTranslate } from '@/i18n/use-translate'
import { RecoverableRenderErrorBoundary } from '../components/error-boundaries/RecoverableRenderErrorBoundary'

import { CrashReportDialog } from '../components/crash-report/CrashReportDialog'
import { MarkdownTemplatePicker } from '../components/editor/markdown/documents/MarkdownTemplatePicker'
import RecentTabSwitcher from '../components/tab-bar/RecentTabSwitcher'
import { ZoomOverlay } from '../components/ZoomOverlay'
import { WslMoveDialogHost } from '../components/wsl-move/WslMoveDialog'

import { useAppStore } from '../store/index'
import { useLazyModalMounts } from './use-lazy-modal-mounts'

const QuickOpen = lazy(() => import('../components/QuickOpen'))

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

const DeleteWorktreeDialog = lazy(
  () => import('../components/sidebar/workspace-actions/deletion/DeleteWorktreeDialog')
)
const PreservedBranchBatchReviewModal = lazy(
  () => import('../components/sidebar/workspace-actions/deletion/PreservedBranchBatchReviewModal')
)

const SshPassphraseDialog = lazy(() =>
  import('../components/ssh-authentication/SshPassphraseDialog').then((module) => ({
    default: module.SshPassphraseDialog
  }))
)
const RemoteServerUpdateDialog = lazy(
  () => import('../components/settings/runtime-environments/updates/RemoteServerUpdateDialog')
)

// Load the pet asset/overlay only when enabled.

/** Keep root overlays in stable sibling order; fetch gated chunks only when their surfaces can appear. Memoized so active-workspace App renders skip every root overlay. */
export const AppRootSurfaces = memo(function AppRootSurfaces(): React.JSX.Element {
  const t = useTranslate()
  // Memoized: subscribe so a language change still repaints its labels.
  useTranslation()
  const { mountedLazyModalIds, shouldMountAddRepoDialog } = useLazyModalMounts()

  const activeView = useAppStore((s) => s.activeView)
  const activeModal = useAppStore((s) => s.activeModal)
  // Subscribe only to consumed settings so unrelated preferences cannot rerender every overlay.

  // RA: legacy UI state cannot load usage/plugin status workers or voice/pet features.

  const hasSshCredentialRequest = useAppStore((s) => s.sshCredentialQueue.length > 0)

  return (
    <>
      {/* Keep Create in the entry bundle so a stale lazy chunk cannot strand users. */}

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
      <Suspense fallback={null} />
      <Suspense fallback={null}>
        {mountedLazyModalIds.has('quick-open') ? (
          <ModalBoundary boundaryId="modal.quick-open" resetKey={activeModal === 'quick-open'}>
            <QuickOpen />
          </ModalBoundary>
        ) : null}
      </Suspense>
      {/* RA: no automatic setup observer or contextual tour overlay. */}
      {/* Wait for UI hydration so default visibility cannot flash a saved-hidden pet. */}

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
