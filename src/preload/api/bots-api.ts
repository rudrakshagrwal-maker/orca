// RA: Optional desktop capability, absent on paired/web clients.
import type { BotLaunch, BotProfileSnapshot } from '../../shared/bot-profile-types'
export type BotsApi = {
  open: (input: {
    botId: string
    sessionId?: string | null
    worktree: string
    requestId: string
  }) => Promise<{ sessionId: string; nativeSessionId: string | null; worktreeId: string }>
  list: (refresh?: boolean) => Promise<BotProfileSnapshot>
  launch: (key: string, sessionId?: string | null) => Promise<BotLaunch>
}
