// RA: restored requests retain admission, validation and streaming semantics.
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { RpcDispatcher } from './dispatcher'
import { defineMethod, defineStreamingMethod } from './core'
import type { OrcaRuntimeService } from '../orca-runtime'

function runtime(): OrcaRuntimeService {
  // Minimal host for ordinary provider requests; no runtime processes are started.
  return { getRuntimeId: () => 'lazy-test', recordFeatureInteraction: () => {} } as unknown as OrcaRuntimeService
}

describe('lazy provider admission', () => {
  it('validates the loaded schema before invoking the restored handler', async () => {
    let effect = ''
    const dispatcher = new RpcDispatcher({
      runtime: runtime(), methods: [],
      loadMethods: async () => [defineMethod({
        name: 'github.lazyTest', permission: 'workspace',
        params: z.object({ value: z.string().min(1) }),
        handler: ({ value }) => { effect = value; return value }
      })]
    })
    const invalid = await dispatcher.dispatch({ id: 'invalid', authToken: 't', method: 'github.lazyTest', params: { value: 42 } })
    expect(invalid).toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
    expect(effect).toBe('')
    const valid = await dispatcher.dispatch({ id: 'valid', authToken: 't', method: 'github.lazyTest', params: { value: 'opened' } })
    expect(valid).toMatchObject({ ok: true, result: 'opened' })
    expect(effect).toBe('opened')
  })

  it('preserves streaming behavior for lazy task-provider methods', async () => {
    const dispatcher = new RpcDispatcher({
      runtime: runtime(), methods: [],
      loadMethods: async () => [defineStreamingMethod({
        name: 'jira.lazyStream', permission: 'workspace', params: z.object({}),
        handler: async (_params, _context, emit) => { emit({ ready: true }) }
      })]
    })
    const responses: unknown[] = []
    await dispatcher.dispatchStreamingObjects({ id: 'stream', authToken: 't', method: 'jira.lazyStream', params: {} }, (response) => responses.push(response))
    expect(responses).toEqual([expect.objectContaining({ ok: true, result: { ready: true }, streaming: true })])
  })

  it('refuses an ungranted lazy method before its service effects', async () => {
    let effect = false
    const dispatcher = new RpcDispatcher({
      runtime: runtime(), methods: [], callerScope: { kind: 'runtime-paired', grants: [] },
      loadMethods: async () => [defineMethod({
        name: 'plugins.restrictedTest', permission: 'pairing-admin', params: z.object({}),
        handler: () => { effect = true; return null }
      })]
    })
    const response = await dispatcher.dispatch({ id: 'denied', authToken: 't', method: 'plugins.restrictedTest', params: {} })
    expect(response).toMatchObject({ ok: false, error: { code: 'forbidden' } })
    expect(effect).toBe(false)
  })
})
