import { describe, expect, it, vi } from 'vitest'
const run = vi.hoisted(() => vi.fn())
vi.mock('@orca/process-host', () => ({ runProcess: run }))
vi.mock('../ssh/system-transport/system-ssh-binary', () => ({
  findSystemSsh: () => '/usr/bin/ssh'
}))
import { readPeerBotProfiles } from './hermes-peer-reader'
import { hermesBotProcess } from './hermes-bot-process'
import { DEFAULT_HERMES_PEERS } from '../../shared/hermes-peers'

describe('Hermes peer boundary', () => {
  it('projects remote chats into host-qualified bot identities', async () => {
    run.mockResolvedValue({
      code: 0,
      stdout: JSON.stringify([
        {
          id: 'a2z',
          label: 'A2Z',
          home: '/home/hermes/.hermes/profiles/a2z',
          chats: [{ id: 'chat-1', title: 'Question', preview: 'Answer', updatedAt: 2000 }]
        }
      ])
    })
    expect((await readPeerBotProfiles(DEFAULT_HERMES_PEERS[0])).profiles).toMatchObject([
      { key: 'box:a2z', host: 'box', id: 'a2z', chats: [{ id: 'chat-1', preview: 'Answer' }] }
    ])
  })
  it('turns SSH failures and malformed replies into a muted peer failure', async () => {
    run.mockRejectedValueOnce(new Error('timeout'))
    expect(await readPeerBotProfiles(DEFAULT_HERMES_PEERS[0])).toMatchObject({
      profiles: [],
      error: 'Unreachable. Check SSH or Refresh.'
    })
    run.mockResolvedValue({ code: 0, stdout: 'not-json' })
    expect((await readPeerBotProfiles(DEFAULT_HERMES_PEERS[0])).profiles).toEqual([])
  })
  it('launches the peer profile over SSH and rejects removed or changed peers', () => {
    const launch = hermesBotProcess(
      'box:a2z',
      '/home/hermes/.hermes/profiles/a2z',
      {},
      DEFAULT_HERMES_PEERS
    )
    expect(launch.command).toBe('/usr/bin/ssh')
    expect(launch.args.at(-1)).toBe(
      "'sudo' '-n' '-u' 'hermes' 'env' 'HERMES_HOME=/home/hermes/.hermes' '/home/hermes/.local/bin/hermes' '-p' 'a2z' 'acp'"
    )
    expect(launch.sessionCwd).toBe('/home/hermes/.hermes/profiles/a2z')
    expect(() =>
      hermesBotProcess('box:a2z', '/different-account', {}, DEFAULT_HERMES_PEERS)
    ).toThrow('home changed')
    expect(() => hermesBotProcess('box:a2z', '/home/hermes/.hermes/profiles/a2z', {}, [])).toThrow(
      'removed'
    )
    expect(() => hermesBotProcess('box:a2z;touch', '/home', {}, DEFAULT_HERMES_PEERS)).toThrow(
      'Invalid bot'
    )
  })
})
