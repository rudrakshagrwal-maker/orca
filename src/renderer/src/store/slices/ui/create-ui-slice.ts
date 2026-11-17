// RA: removed pages and onboarding have no registered store actions.
import type { StateCreator } from 'zustand'
import type { AppState } from '../../types'
import type { UISlice } from './ui-slice-contract'
import { createUiAgentActions } from './ui-slice-agent-actions'
import { createUiSettingsActions } from './ui-slice-settings-actions'
import { createUiModalActions } from './ui-slice-modal-actions'
import { createUiFeatureActions } from './ui-slice-feature-actions'
import { createUiTourActions } from './ui-slice-tour-actions'
import { createUiTrustActions } from './ui-slice-trust-actions'
import { createUiPreferenceActions } from './ui-slice-preference-actions'
import { createUiSurfaceActions } from './ui-slice-surface-actions'
import { createUiPersistenceActions } from './ui-slice-persistence-actions'
import { createUiHydrationActions } from './ui-slice-hydration-actions'
import { createUiUpdateActions } from './ui-slice-update-actions'

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set, get) =>
  ({
    // RA: terminal/browser activation and Settings retain their navigation state without Tasks.
    activeView: 'terminal',
    previousViewBeforeSettings: 'terminal',
    setActiveView: (view) => set({ activeView: view === 'settings' ? 'settings' : 'terminal' }),
    ...createUiAgentActions(set, get),
    ...createUiSettingsActions(set, get),
    ...createUiModalActions(set, get),
    ...createUiFeatureActions(set, get),
    // RA: tours never render (no overlay mounted), but dialogs and the sidebar still call these.
    ...createUiTourActions(set, get),
    ...createUiTrustActions(set, get),
    ...createUiPreferenceActions(set, get),
    ...createUiSurfaceActions(set, get),
    ...createUiPersistenceActions(set, get),
    ...createUiHydrationActions(set, get),
    ...createUiUpdateActions(set, get)
  }) as UISlice
