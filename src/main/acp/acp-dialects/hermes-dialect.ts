import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { AcpDialect } from './acp-dialect'

const replayUser = z.looseObject({
  update: z.looseObject({
    sessionUpdate: z.literal('user_message_chunk'),
    content: z.unknown()
  })
})

export const HERMES_ACP_DIALECT: AcpDialect = {
  // Hermes replays whole user messages without IDs; content plus occurrence stays stable on reload.
  historyFrames: (frames) => {
    const occurrences = new Map<string, number>()
    return frames.map((frame) => {
      const parsed = replayUser.safeParse(frame.params)
      if (!parsed.success) {
        return frame
      }
      const hash = createHash('sha256')
        .update(JSON.stringify(parsed.data.update.content))
        .digest('hex')
      const occurrence = occurrences.get(hash) ?? 0
      occurrences.set(hash, occurrence + 1)
      return {
        ...frame,
        params: {
          ...parsed.data,
          update: { ...parsed.data.update, messageId: `hermes-${hash}-${occurrence}` }
        }
      }
    })
  }
}
