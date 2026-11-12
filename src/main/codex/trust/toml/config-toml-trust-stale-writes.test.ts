import { describe, expect, it } from 'vitest'
import { upsertProjectTrustContent } from './config-toml-project-trust'

describe('config.toml partial and stale writes', () => {
  it('preserves a truncated malformed prefix while appending trust', () => {
    const partial = ['model = "gpt-5"', '[mcp_servers.partial', 'command = "still-user-data'].join(
      '\n'
    )
    const updated = upsertProjectTrustContent(partial, 'C:/Remote/Repo', 'trusted', {
      alreadyCanonical: true
    })

    expect(updated.startsWith(partial)).toBe(true)
    expect(updated).toContain('[projects."C:/Remote/Repo"]')
  })

})
