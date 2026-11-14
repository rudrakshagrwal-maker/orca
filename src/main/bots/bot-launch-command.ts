import type { BotLaunch, BotProfile, HermesPeer } from '../../shared/bot-profile-types'
import { hermesSshArgs } from './hermes-peer-transport'
import {
  buildShellCommandFromArgv,
  resolveStartupShell
} from '../../shared/agent-launch/startup/tui-agent-startup-shell'
import { validBotId } from './bot-profile-catalog'
import { validSessionId } from './hermes-chat-reader'

export function buildBotLaunch(
  profile: BotProfile,
  sessionId?: string | null,
  peers: HermesPeer[] = []
): BotLaunch {
  if (
    profile.source !== 'hermes' ||
    !['local TUI', 'remote TUI'].includes(profile.application) ||
    !validBotId(profile.id)
  ) {
    throw new Error('Invalid local bot profile')
  }
  const resume = sessionId === undefined ? profile.chats?.[0]?.id : sessionId
  if (resume && (!validSessionId(resume) || !profile.chats?.some((chat) => chat.id === resume))) {
    throw new Error('Chat is no longer available. Refresh Bots.')
  }
  if (sessionId === undefined && profile.error) {
    throw new Error(profile.error)
  }
  if (profile.application === 'remote TUI') {
    const peer = peers.find((candidate) => candidate.name === profile.host)
    if (!peer) {
      throw new Error('Hermes peer was removed. Refresh Bots.')
    }
    return {
      label: profile.label,
      agentArgs: '',
      command: buildShellCommandFromArgv(
        [
          'ssh',
          ...hermesSshArgs(
            peer,
            [peer.hermesBin, '-p', profile.id, '--tui', ...(resume ? ['--resume', resume] : [])],
            true
          )
        ],
        resolveStartupShell(process.platform)
      )
    }
  }
  return {
    label: profile.label,
    agentArgs: `-p ${profile.id} --tui${resume ? ` --resume ${resume}` : ''}`
  }
}
