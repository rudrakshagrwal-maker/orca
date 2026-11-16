// RA: Commands are built solely from main-owned catalogue entries and fixed executable paths.
import { quoteStartupArg } from '../../shared/agent-launch/startup/tui-agent-startup-shell'
import type { BotLaunch, BotProfile } from '../../shared/bot-profile-types'
import { HERMES_SSH_ARGS, validBotId } from './bot-profile-catalog'

export function buildBotLaunch(profile: BotProfile, platform: NodeJS.Platform = process.platform): BotLaunch {
  if (!validBotId(profile.id)) throw new Error('Invalid bot profile')
  if (platform !== 'win32') throw new Error('These bot launchers require the local Windows desktop')
  const quote = (value: string) => quoteStartupArg(value, 'powershell')
  const identity = { key: profile.key, id: profile.id, source: profile.source, home: profile.home } // RA: no model/gateway identity inferred.
  if (profile.source === 'hermes') {
    const remote = `cd /home/hermes && exec /home/hermes/.local/bin/hermes --profile ${quoteStartupArg(profile.id, 'posix')} --tui`
    return { label: profile.label, shell: 'powershell.exe', identity: { ...identity, remotePath: '/home/hermes' }, command: `& ssh ${['-tt', ...HERMES_SSH_ARGS, remote].map(quote).join(' ')}` }
  }
  return { label: `${profile.label} (${profile.application})`, shell: 'powershell.exe', identity, command: `& dsh --profile ${quote(profile.id)}`, env: { DSH_HOME: profile.home } }
}
