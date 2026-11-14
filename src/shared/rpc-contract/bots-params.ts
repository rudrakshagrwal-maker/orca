import { z } from 'zod'
export const BotOpenParams = z
  .object({
    botId: z.string().min(1).max(130),
    sessionId: z.string().min(1).max(256).nullable().optional(),
    worktree: z.string().min(1).max(4096),
    requestId: z.uuid(),
    show: z.boolean().optional()
  })
  .strict()
