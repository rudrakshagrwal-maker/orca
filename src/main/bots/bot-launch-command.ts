import type { BotLaunch, BotProfile } from '../../shared/bot-profile-types'
import { validBotId } from './bot-profile-catalog'
import { validSessionId } from './hermes-chat-reader'

export function buildBotLaunch(profile: BotProfile, sessionId?: string | null): BotLaunch {
  if (
    profile.source !== 'hermes' ||
    profile.application !== 'local TUI' ||
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
  return {
    label: profile.label,
    agentArgs: `-p ${profile.id} --tui${resume ? ` --resume ${resume}` : ''}`
  }
}
