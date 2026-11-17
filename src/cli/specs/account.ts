// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import { LOCAL_COMMAND_FLAGS, type CommandSpec } from '../args'

// Terminal login lets headless hosts manage accounts without the desktop login UI.
export const ACCOUNT_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['account', 'add'],
    summary: 'Add a managed agent account by signing in on this Orca host',
    usage: 'orca account add [--agent claude|codex] [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'agent'],

    notes: [
      'Runs the agent login (`claude login` / `codex login`) in this terminal, then registers the account with the local Orca runtime.',
      'Codex uses device authorization so the browser can complete sign-in from a different machine.',

      'Sign in with the account you want to add (e.g. use a private/incognito browser window for a second account).',
      '--agent defaults to claude. Requires the Orca runtime to be running on this machine.'
    ],
    examples: ['orca account add', 'orca account add --agent codex']
  },
  {
    path: ['account', 'list'],
    summary: 'List managed agent accounts on this Orca host',
    usage: 'orca account list [--agent claude|codex] [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'agent'],
    notes: [
      "Lists the accounts on this machine with the ids `orca account select` and `orca account rm` accept. `system` is the provider's own sign-in outside Orca.",
      '`--environment` / `--pairing-code` are rejected rather than ignored; run it on the host whose accounts you want to see.'
    ],
    examples: ['orca account list', 'orca account list --agent claude']
  },
  {
    path: ['account', 'select'],
    summary: 'Select the account new agent launches use on this Orca host',
    usage: 'orca account select --agent claude|codex --account <id|email|label|system> [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'agent', 'account'],
    notes: [
      "--account takes an id, email or label from `orca account list`, or `system` for the provider's own sign-in. An email shared by several accounts is refused; pass the id."
    ],
    examples: [
      'orca account select --agent claude --account me@work.example',
      'orca account select --agent codex --account system'
    ]
  },
  {
    path: ['account', 'rm'],
    aliases: [['account', 'remove']],
    destructive: true,
    summary: 'Remove a managed agent account and its private data',
    usage: 'orca account rm --agent claude|codex --account <id|email|label> [--json]',
    allowedFlags: [...LOCAL_COMMAND_FLAGS, 'agent', 'account'],
    notes: []
  }
]
