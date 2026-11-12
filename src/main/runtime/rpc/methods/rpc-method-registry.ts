import { STATUS_METHODS } from './host-management/status'
import { SIDEBAR_INPUT_METHODS } from './sidebar-inputs/sidebar-inputs'
import { ORCAD_TERMINAL_CENSUS_METHODS } from './orcad/orcad-terminal-census'
import { ORCAD_MIGRATION_METHODS } from './orcad/orcad-migration'
import { SESSION_TERMINAL_SCROLLBACK_METHODS } from './terminal/session-terminal-scrollback'
import { REPO_METHODS } from './projects/repo'
import { WORKTREE_METHODS } from './workspaces/worktree'
import { AGENT_ACTIVITY_METHODS } from './workspaces/agent-activity-methods'
import { REFERENCE_METHODS } from './reference/reference'
import { TERMINAL_METHODS } from './terminal/terminal'
import { TERMINAL_ORPHAN_METHODS } from './terminal/terminal-orphan'
import { ORCHESTRATION_METHODS } from './orchestration/orchestration'
import { STATS_METHODS } from './host-management/stats'
import { DIAGNOSTICS_METHODS } from './host-management/diagnostics'
import { TERMINAL_DAEMON_METHODS } from './terminal/terminal-daemon'
import { ACCOUNT_METHODS } from './accounts/accounts'
import { PREFLIGHT_METHODS } from './preflight/preflight'
import { SESSION_TAB_METHODS } from './session-tabs/session-tabs'
import { FILE_METHODS } from './files/files'
import { GIT_METHODS } from './source-control/git/git'
import { SSH_METHODS } from './ssh/ssh'
import { MANAGED_SERVER_METHODS } from './host-management/managed-server'
import { ENVIRONMENT_DOCTOR_METHODS } from './host-management/environment-doctor'
import { CLIENT_UI_METHODS } from './client-state/client-ui'
import { CLIENT_EVENT_METHODS } from './client-events/client-events'
import { CLIPBOARD_METHODS } from './clipboard/clipboard'
import { HOST_CAPABILITY_METHODS } from './host-management/host-capabilities'
import { RUNTIME_CLIENT_CAPABILITY_METHODS } from './client-events/runtime-client-capabilities'
import { UPDATER_METHODS } from './updater/updater'
import { AGENT_SESSION_METHODS } from './terminal/agent-session'
import { MANAGED_RUNTIME_INSTALL_METHODS } from './host-management/managed-runtime-install'
import { AGENT_LAUNCH_METHODS } from './agent-launch/agent-launch'
import {
  LAYOUT_APPLY_METHODS,
  LAYOUT_VIEW_REPORT_METHODS,
  WORKSPACE_LAYOUT_METHODS
} from './workspace-layout/workspace-layout'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../../../shared/layout-owner-switch'
import { ORCA_SIDEBAR_INPUTS_IS_MAIN } from '../../../../shared/sidebar-inputs-switch'

// RA: only import terminal/orchestration RPC; disabled handlers must stay outside startup.
export const ALL_RPC_METHODS = [
  ...STATUS_METHODS,
  ...ORCAD_TERMINAL_CENSUS_METHODS,
  ...ORCAD_MIGRATION_METHODS,
  ...SESSION_TERMINAL_SCROLLBACK_METHODS,
  ...REPO_METHODS,
  ...WORKTREE_METHODS,
  ...AGENT_ACTIVITY_METHODS,
  ...REFERENCE_METHODS,
  ...AGENT_SESSION_METHODS,
  ...MANAGED_RUNTIME_INSTALL_METHODS,
  ...AGENT_LAUNCH_METHODS,
  ...TERMINAL_METHODS,
  ...TERMINAL_ORPHAN_METHODS,
  ...ORCHESTRATION_METHODS,
  ...STATS_METHODS,
  ...DIAGNOSTICS_METHODS,
  ...TERMINAL_DAEMON_METHODS,
  ...ACCOUNT_METHODS,
  ...PREFLIGHT_METHODS,
  ...SESSION_TAB_METHODS,
  ...WORKSPACE_LAYOUT_METHODS,
  // Switch point: a window-owned build registers no layout command.
  ...(ORCA_LAYOUT_OWNER_IS_MAIN ? [...LAYOUT_APPLY_METHODS, ...LAYOUT_VIEW_REPORT_METHODS] : []),
  ...FILE_METHODS,
  ...GIT_METHODS,
  ...SSH_METHODS,
  ...MANAGED_SERVER_METHODS,
  ...ENVIRONMENT_DOCTOR_METHODS,
  ...CLIPBOARD_METHODS,
  ...HOST_CAPABILITY_METHODS,
  ...RUNTIME_CLIENT_CAPABILITY_METHODS,
  ...CLIENT_EVENT_METHODS,
  ...CLIENT_UI_METHODS,
  // Switch point: a window-fed build publishes no sidebar input.
  ...(ORCA_SIDEBAR_INPUTS_IS_MAIN ? SIDEBAR_INPUT_METHODS : []),
  ...UPDATER_METHODS
]
