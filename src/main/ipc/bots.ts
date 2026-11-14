// RA: Discovery and launch are local trusted-desktop capabilities.
import { ipcMain } from 'electron'
import { isTrustedUIRenderer } from './ui'
import { getBotProfiles } from '../bots/bot-profile-catalog'
import { buildBotLaunch } from '../bots/bot-launch-command'
import type { Store } from '../persistence/loading-store/store'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { resolveHermesPeers } from '../../shared/hermes-peers'
import { BotOpenParams } from '../../shared/rpc-contract/bots-params'
export function registerBotHandlers(store: Store, runtime: OrcaRuntimeService): void {
  const peers = () => resolveHermesPeers(store.getSettings().hermesPeers)
  ipcMain.handle('bots:open', async (event, input: unknown) => {
    if (!isTrustedUIRenderer(event.sender)) {
      throw new Error('Trusted desktop required')
    }
    const { openBotChat } = await import('../bots/open-bot-chat.js')
    return openBotChat(BotOpenParams.parse(input), { runtime, caller: { kind: 'desktop' } })
  })
  ipcMain.handle('bots:list', (event, refresh: unknown) => {
    if (!isTrustedUIRenderer(event.sender)) {
      throw new Error('Trusted desktop required')
    }
    return getBotProfiles(refresh === true, peers())
  })
  ipcMain.handle('bots:launch', async (event, key: unknown, sessionId: unknown) => {
    if (!isTrustedUIRenderer(event.sender)) {
      throw new Error('Trusted desktop required')
    }
    if (typeof key !== 'string' || key.length > 1024) {
      throw new Error('Invalid profile key')
    }
    if (
      sessionId !== undefined &&
      sessionId !== null &&
      (typeof sessionId !== 'string' || !sessionId.length || sessionId.length > 256)
    ) {
      throw new Error('Invalid chat identity')
    }
    const profile = (await getBotProfiles(true, peers())).profiles.find((p) => p.key === key)
    if (!profile) {
      throw new Error('Profile is no longer in the catalogue; refresh Bots')
    }
    return buildBotLaunch(profile, sessionId, peers())
  })
}
