import { describe, expect, it, vi } from 'vitest'
import { createSessionSearchClient } from './ai-vault-search-client'

describe.each(['runtime', 'relay'] as const)('missing search status over %s', (transport) => {


  it.each([
    { code: 'unauthorized', message: 'Authentication required' },
    { code: 'connection_closed', message: 'Host disconnected' },
    { code: -32000, message: 'Execution host refused request' }
  ])('propagates status failure $code without a search', async (error) => {
    const call = vi.fn(async () => {
      throw error
    })
    await expect(
      createSessionSearchClient(call, transport).searchSessions({
        query: 'needle',
        filters: { agents: ['claude'] }
      })
    ).rejects.toEqual(error)
    expect(call).toHaveBeenCalledExactlyOnceWith('aiVault.searchStatus', {})
  })

  it('reports no service only when the search method itself is missing', async () => {
    const call = vi.fn(async () => {
      throw { code: 'method_not_found' }
    })
    expect(
      await createSessionSearchClient(call, transport).searchSessions({
        query: 'needle',
        filters: { agents: ['claude'] }
      })
    ).toEqual({ kind: 'unavailable', reason: 'no-service' })
    expect(call.mock.calls).toEqual([
      ['aiVault.searchStatus', {}],
      [
        'aiVault.searchSessions',
        expect.objectContaining({ query: 'needle', filters: { agents: ['claude'] } })
      ]
    ])
  })
})
