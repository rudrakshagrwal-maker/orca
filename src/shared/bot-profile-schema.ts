// RA: Persist reconnect identity, never a saved command, environment or token.
import { z } from 'zod'
export const botTerminalIdentitySchema = z.object({
  key: z.string().max(1024),
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/),
  source: z.enum(['hermes', 'dsh']),
  home: z.string().max(1024),
  remotePath: z.string().max(1024).optional()
})
