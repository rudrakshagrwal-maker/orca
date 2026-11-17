
import type { CommandHandler } from '../dispatch'

import { TERMINAL_DAEMON_HANDLERS } from './terminal-daemon'

export const DIAGNOSTICS_HANDLERS: Record<string, CommandHandler> = {
  
  ...TERMINAL_DAEMON_HANDLERS
}
