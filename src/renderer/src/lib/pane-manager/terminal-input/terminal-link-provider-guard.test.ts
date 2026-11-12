// RA: hidden terminals must neither scan links nor publish a stale async result.
import { describe, expect, it } from 'vitest'
import type { ILinkProvider, Terminal } from '@xterm/xterm'
import { installGuardedLinkProviderRegistration, setTerminalLinkDetectionSuspended } from './terminal-link-provider-guard'

describe('hidden terminal link detection', () => {
  it('suppresses detection while hidden and restores it when shown', () => {
    let registered: ILinkProvider | undefined
    const terminal = { registerLinkProvider: (provider: ILinkProvider) => {
      registered = provider
      return { dispose: () => {} }
    } } as unknown as Terminal
    installGuardedLinkProviderRegistration(terminal)
    let result: Parameters<Parameters<ILinkProvider['provideLinks']>[1]>[0]
    terminal.registerLinkProvider({ provideLinks: (_line, callback) => callback([]) })
    setTerminalLinkDetectionSuspended(terminal, true)
    registered!.provideLinks(1, (links) => { result = links })
    expect(result).toBeUndefined()
    setTerminalLinkDetectionSuspended(terminal, false)
    registered!.provideLinks(1, (links) => { result = links })
    expect(result).toEqual([])
  })

  it('discards a link result delivered after its terminal is hidden', () => {
    let registered: ILinkProvider | undefined
    let finish: Parameters<ILinkProvider['provideLinks']>[1] | undefined
    const terminal = { registerLinkProvider: (provider: ILinkProvider) => {
      registered = provider
      return { dispose: () => {} }
    } } as unknown as Terminal
    installGuardedLinkProviderRegistration(terminal)
    terminal.registerLinkProvider({ provideLinks: (_line, callback) => { finish = callback } })
    let result: Parameters<Parameters<ILinkProvider['provideLinks']>[1]>[0] = []
    registered!.provideLinks(1, (links) => { result = links })
    setTerminalLinkDetectionSuspended(terminal, true)
    finish!([])
    expect(result).toBeUndefined()
  })
})
