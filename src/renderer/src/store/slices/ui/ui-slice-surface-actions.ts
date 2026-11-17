// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import type { UISlice, UISliceGet, UISliceSet } from './ui-slice-contract'
import { revokeCustomPetBlobUrl } from '../../../components/pet/pet-blob-cache'
import { DEFAULT_PET_ID } from '../../../components/pet/pet-models'
import {
  PET_SIZE_DEFAULT,
  PET_SIZE_MAX,
  PET_SIZE_MIN,
  type CustomPet
} from '../../../../../shared/pet-types'
import { clampPetSize } from './ui-slice-hydration-sanitizers'

export function createUiSurfaceActions(set: UISliceSet, _get: UISliceGet): Partial<UISlice> {
  return {
    // Why: target changes rebuild the aggregate without republishing or clearing per-host scans.

    // Why: drop stale per-host scans in one store update so a large host set can't fan out notifications to every subscriber.

    // Preserve root identity so no-op writes do not notify every store subscriber.

    // Why: default true so enabling experimentalPet shows the pet immediately (persisted; "Hide pet" flips it false).
    petVisible: true,
    setPetVisible: (v) => {
      window.api.ui.set({ petVisible: v }).catch(console.error)
      set({ petVisible: v })
    },

    petId: DEFAULT_PET_ID,
    setPetId: (id) => {
      window.api.ui.set({ petId: id }).catch(console.error)
      set({ petId: id })
    },

    petSize: PET_SIZE_DEFAULT,
    setPetSize: (size) => {
      const clamped = clampPetSize(size, {
        min: PET_SIZE_MIN,
        max: PET_SIZE_MAX,
        fallback: PET_SIZE_DEFAULT
      })
      window.api.ui.set({ petSize: clamped }).catch(console.error)
      set({ petSize: clamped })
    },

    customPets: [],
    addCustomPet: (model) =>
      set((s) => {
        const next = [...s.customPets.filter((m) => m.id !== model.id), model]
        window.api.ui.set({ customPets: next }).catch(console.error)
        return { customPets: next }
      }),
    removeCustomPet: (id) =>
      set((s) => {
        const target = s.customPets.find((m) => m.id === id)
        if (!target) {
          return s
        }
        const next = s.customPets.filter((m) => m.id !== id)
        // Why: removing the active custom pet falls back to bundled default so the overlay isn't empty.
        const fallback = s.petId === id ? DEFAULT_PET_ID : s.petId
        // Why: single combined IPC update so customPets and petId persist atomically.
        const ipcPayload: { customPets: CustomPet[]; petId?: string } = {
          customPets: next
        }
        if (fallback !== s.petId) {
          ipcPayload.petId = fallback
        }
        window.api.ui.set(ipcPayload).catch(console.error)
        // Why: revoke the cached blob: URL so the Blob is released, not leaked for the session.
        revokeCustomPetBlobUrl(id)
        // Why: best-effort delete — bytes owned by main; fresh-UUID imports mean an orphaned file is never re-referenced.
        window.api.pet.delete(id, target.fileName, target.kind).catch(console.error)
        const partial: Partial<UISlice> = { customPets: next }
        if (fallback !== s.petId) {
          partial.petId = fallback
        }
        return partial
      }),

    pendingRevealWorktree: null,
    pendingRevealSidebarRow: null,
    // Activity view unmounts workspaces; incidental activation must not switch bodies or queue a surprise reveal.
    revealWorktreeInSidebar: (worktreeId, options) =>
      set((state) =>
        state.sidebarBody === 'agents'
          ? state
          : {
              pendingRevealSidebarRow: null,
              pendingRevealWorktree: {
                worktreeId,
                ...(options?.rowKey ? { rowKey: options.rowKey } : {}),
                ...(options?.executionHostId ? { executionHostId: options.executionHostId } : {}),
                behavior: options?.behavior ?? 'smooth',
                ...(options?.highlight ? { highlight: true } : {}),
                ...(options?.beginRename ? { beginRename: true } : {})
              }
            }
      ),
    revealSidebarRow: (rowKey, options) =>
      set((state) =>
        state.sidebarBody === 'agents'
          ? state
          : {
              pendingRevealWorktree: null,
              pendingRevealSidebarRow: {
                rowKey,
                behavior: options?.behavior ?? 'smooth',
                ...(options?.highlight === false ? {} : { highlight: true })
              }
            }
      ),
    clearPendingRevealWorktreeId: (expected) =>
      set((state) =>
        expected !== undefined && state.pendingRevealWorktree !== expected
          ? state
          : { pendingRevealWorktree: null }
      ),
    clearPendingRevealSidebarRow: (expected) =>
      set((state) =>
        expected !== undefined && state.pendingRevealSidebarRow !== expected
          ? state
          : { pendingRevealSidebarRow: null }
      ),
    scrollToDiffCommentId: null,
    setScrollToDiffCommentId: (id) => set({ scrollToDiffCommentId: id })

    // Restore floating panel size/open state to avoid reopen/remaximize reflow of live TUI buffers (floating-terminal-panel-view-state).
  }
}
