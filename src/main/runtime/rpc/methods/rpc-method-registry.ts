import { BROWSER_CORE_METHODS } from './browser/browser-core'
import { BROWSER_EXTRA_METHODS } from './browser/browser-extras'
import { BROWSER_IDENTITY_METHODS } from './browser/browser-identity-rpc'
import { BROWSER_CLIENT_HOST_METHODS } from './browser/browser-client-host'
import { BROWSER_CLIENT_FILE_CHANNEL_METHODS } from './browser/browser-client-file-channel'
import { BROWSER_NETWORK_TUNNEL_METHODS } from './browser/browser-network-tunnel'
import { BROWSER_SCREENCAST_METHODS } from './browser/browser-screencast'
import { DESKTOP_BROWSER_BRIDGE_RPC_METHODS } from './browser/desktop-browser-bridge'
import { STRUCTURED_AGENT_SESSION_OPTIONS_READ_METHODS } from './structured-sessions/catalog/structured-agent-session-options-read'
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
  // RA: agent-browser CLI and embedded browser RPC remain registered.
  ...BROWSER_CORE_METHODS,
  ...BROWSER_EXTRA_METHODS,
  ...BROWSER_IDENTITY_METHODS,
  ...BROWSER_CLIENT_HOST_METHODS,
  ...BROWSER_CLIENT_FILE_CHANNEL_METHODS,
  ...BROWSER_NETWORK_TUNNEL_METHODS,
  ...BROWSER_SCREENCAST_METHODS,
  ...DESKTOP_BROWSER_BRIDGE_RPC_METHODS,

  ...STATUS_METHODS,
  ...ORCAD_TERMINAL_CENSUS_METHODS,
  ...ORCAD_MIGRATION_METHODS,
  ...SESSION_TERMINAL_SCROLLBACK_METHODS,
  ...REPO_METHODS,
  ...WORKTREE_METHODS,
  ...AGENT_ACTIVITY_METHODS,
  ...REFERENCE_METHODS,
  ...AGENT_SESSION_METHODS,
  // RA: terminal launch settings retain model reads/explicit refresh without enabling chat surfaces.
  ...STRUCTURED_AGENT_SESSION_OPTIONS_READ_METHODS.filter(
    (method) => method.name === 'agentSession.modelCatalog'
  ),
  ...AGENT_LAUNCH_METHODS,
  ...TERMINAL_METHODS,
  ...TERMINAL_ORPHAN_METHODS,
  ...ORCHESTRATION_METHODS,
  ...STATS_METHODS,
  
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
