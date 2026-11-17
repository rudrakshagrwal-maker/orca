// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import type { CommandSpec } from '../args'
import { ACCOUNT_COMMAND_SPECS } from './account'
import { BROWSER_ADVANCED_COMMAND_SPECS } from './browser-advanced'
import { BROWSER_BASIC_COMMAND_SPECS } from './browser-basic'

import { CORE_COMMAND_SPECS } from './core'
import { FILE_COMMAND_SPECS } from './file'
import { PROJECT_COMMAND_SPECS } from './project'
import { ORCHESTRATION_COMMAND_SPECS } from './orchestration'
import { withFullRecordFlag } from './orchestration-full-record-flag'
import { ENVIRONMENT_COMMAND_SPECS } from './environment'
import { MANAGED_SERVER_COMMAND_SPECS } from './managed-server'
import { AGENT_HOOK_COMMAND_SPECS } from './agent-hooks'
import { AGENT_LAUNCH_COMMAND_SPECS } from './agent-launch'

import { TERMINAL_DAEMON_COMMAND_SPECS } from './terminal-daemon'

import { INTROSPECTION_COMMAND_SPECS } from './introspection'

import { VM_COMMAND_SPECS } from './vm'
import { VM_ENV_COMMAND_SPECS } from './vm-env'
import { SKILL_COMMAND_SPECS } from './skills'

import { PROFILE_STATE_COMMAND_SPECS } from './profile-state'

export const COMMAND_SPECS: CommandSpec[] = [
  ...CORE_COMMAND_SPECS,

  ...ACCOUNT_COMMAND_SPECS,
  ...PROJECT_COMMAND_SPECS,
  ...FILE_COMMAND_SPECS,

  ...BROWSER_BASIC_COMMAND_SPECS,
  ...BROWSER_ADVANCED_COMMAND_SPECS,
  ...ORCHESTRATION_COMMAND_SPECS.map(withFullRecordFlag),
  ...AGENT_HOOK_COMMAND_SPECS,
  ...AGENT_LAUNCH_COMMAND_SPECS,
  ...TERMINAL_DAEMON_COMMAND_SPECS,
  ...INTROSPECTION_COMMAND_SPECS,
  ...ENVIRONMENT_COMMAND_SPECS,
  ...MANAGED_SERVER_COMMAND_SPECS,

  ...VM_COMMAND_SPECS,
  ...VM_ENV_COMMAND_SPECS,

  ...SKILL_COMMAND_SPECS,
  ...PROFILE_STATE_COMMAND_SPECS
]
