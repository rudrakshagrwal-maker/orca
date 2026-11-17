// RA: no renderer memory-monitor state.
import type { RepoSlice } from './repos/repo-state'
import type { SparsePresetsSlice } from './slices/worktrees/create/sparse-presets'
import type { WorktreeSlice } from './slices/worktrees/worktree-slice-contract'
import type { TerminalSlice } from './terminals/terminal-state'
import type { TabsSlice } from './slices/tabs/tabs-slice-contract'
import type { UISlice } from './slices/ui/ui-slice-contract'
import type { SettingsSlice } from './slices/settings/create-settings-slice'
import type { KeybindingsSlice } from './slices/keybindings/keybindings'

import type { PreflightSlice } from './slices/preflight/preflight'

import type { EditorSlice } from './slices/editor/types/editor-slice'
import type { StatsSlice } from './slices/process-stats/stats'

import type { BrowserSlice } from './slices/browser/browser-slice-contract'

import type { SshSlice } from './slices/ssh/create-ssh-slice'
import type { RuntimeEnvironmentSshSlice } from './slices/ssh/runtime-environment-ssh'
import type { WslHostsSlice } from './slices/wsl/wsl-hosts'
import type { AgentStatusSlice } from './slices/agent-status/agent-status-slice-contract'
import type { PaneForegroundAgentSlice } from './slices/agent-status/pane-foreground-agent'
import type { DiffCommentsSlice } from './slices/diff-comments/create-diff-comments-slice'
import type { DetectedAgentsSlice } from './slices/agent-inventory/create-detected-agents-slice'
import type { RuntimeDetectedAgentsSlice } from './slices/agent-inventory/runtime-detected-agents'
import type { WorktreeNavHistorySlice } from './slices/ui/workspace-navigation-history'
import type { DictationSlice } from './slices/dictation/dictation'
import type { WorkspaceCleanupSlice } from './slices/workspace-cleanup/create-workspace-cleanup-slice'
import type { WorkspaceCleanupBrowseSlice } from './slices/workspace-cleanup/workspace-cleanup-browse'
import type { RuntimeStatusSlice } from './slices/runtime-status/runtime-status-types'

import type { PinnedTabCloseConfirmSlice } from './slices/tabs/pinned-tab-close-confirm'
import type { RecentlyClosedTerminalTabsSlice } from './terminals/recently-closed-terminal-tabs'
import type { RecentlyClosedTabsSlice } from './slices/tabs/recently-closed-tabs'
import type { OrcaProfilesSlice } from './slices/orca-profiles/create-orca-profiles-slice'

import type { FeedbackDraftSlice } from './slices/feedback/feedback-draft'

import type { RemoteServerUpdatesSlice } from './slices/runtime-host-updates/remote-server-updates'
import type { TerminalQuickCommandHostsSlice } from './terminals/terminal-quick-command-hosts'
import type { StructuredSessionLaunchDirectorySlice } from './slices/agent-status/structured-session-launch-directories'
import type { StructuredChatSleptAtSlice } from './slices/agent-status/structured-chat-slept-at'
import type { StructuredChatCompanionWritesSlice } from './slices/agent-status/structured-chat-companion-writes'
import type { EphemeralVmLifecycleSlice } from './slices/ephemeral-vm/ephemeral-vm-lifecycle'
import type { WorkspaceAttentionSlice } from './slices/workspace-attention/workspace-attention-contract'

export type AppState = RepoSlice &
  SparsePresetsSlice &
  WorktreeSlice &
  TerminalSlice &
  TabsSlice &
  UISlice &
  SettingsSlice &
  KeybindingsSlice &
  PreflightSlice &
  EditorSlice &
  StatsSlice &
  BrowserSlice &
  SshSlice &
  RuntimeEnvironmentSshSlice &
  WslHostsSlice &
  AgentStatusSlice &
  PaneForegroundAgentSlice &
  DiffCommentsSlice &
  DetectedAgentsSlice &
  RuntimeDetectedAgentsSlice &
  WorktreeNavHistorySlice &
  DictationSlice &
  WorkspaceCleanupSlice &
  WorkspaceCleanupBrowseSlice &
  RuntimeStatusSlice &
  PinnedTabCloseConfirmSlice &
  RecentlyClosedTerminalTabsSlice &
  RecentlyClosedTabsSlice &
  OrcaProfilesSlice &
  FeedbackDraftSlice &
  RemoteServerUpdatesSlice &
  TerminalQuickCommandHostsSlice &
  StructuredSessionLaunchDirectorySlice &
  StructuredChatSleptAtSlice &
  StructuredChatCompanionWritesSlice &
  WorkspaceAttentionSlice &
  EphemeralVmLifecycleSlice
