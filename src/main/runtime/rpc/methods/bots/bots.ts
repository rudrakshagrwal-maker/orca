import { z } from 'zod'
import { defineMethod } from '../../core'
import { BotOpenParams } from '../../../../../shared/rpc-contract/bots-params'
import { getBotProfiles } from '../../../../bots/bot-profile-catalog'
import { openBotChat } from '../../../../bots/open-bot-chat'
import { resolveHermesPeers } from '../../../../../shared/hermes-peers'

export const BOT_METHODS = [
  defineMethod({
    name: 'bots.list',
    permission: 'workspace',
    params: z.object({}).strict(),
    handler: (_params, ctx) =>
      getBotProfiles(true, resolveHermesPeers(ctx.runtime.requireStore().getSettings().hermesPeers))
  }),
  defineMethod({
    name: 'bots.open',
    permission: 'workspace',
    params: BotOpenParams,
    handler: openBotChat
  })
]
