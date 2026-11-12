// RA: Optional desktop capability, absent on paired/web clients.
import type { BotLaunch, BotProfileSnapshot } from '../../shared/bot-profile-types'
export type BotsApi = {
  list: (refresh?: boolean) => Promise<BotProfileSnapshot>
  launch: (key: string) => Promise<BotLaunch>
}
