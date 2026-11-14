import { GLOBAL_FLAGS, type CommandSpec } from '../args'
export const BOT_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['bots', 'list'],
    summary: 'List local and peer Hermes bots',
    usage: 'orca bots list [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['bots', 'ask'],
    summary: 'Send a message to a Hermes bot and wait for its reply',
    usage: 'orca bots ask <bot-id> "<message>" [--session <id> | --new] [--json]',
    positionalArgs: ['bot-id', 'message'],
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'bot-id',
      'message',
      'session',
      'new',
      'worktree',
      'timeout-ms'
    ],
    notes: [
      'Defaults to the newest chat. --new starts a fresh chat. --session accepts a Hermes or Orca session id.',
      'Requires an Orca workspace (current directory or --worktree). Approvals remain interactive; a blocked reply exits 1.'
    ]
  },
  {
    path: ['bots', 'open'],
    summary: 'Open a bot in Orca native chat',
    usage: 'orca bots open <bot-id> [--session <id>] [--json]',
    positionalArgs: ['bot-id'],
    allowedFlags: [...GLOBAL_FLAGS, 'bot-id', 'session', 'worktree']
  }
]
