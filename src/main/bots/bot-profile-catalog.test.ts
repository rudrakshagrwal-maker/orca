// RA: Offline-safe parsing and shell boundaries, with no remote calls or model generations.
import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: {} }))
import { parseHermesProfiles } from './bot-profile-catalog'
import { buildBotLaunch } from './bot-launch-command'
import type { BotProfile } from '../../shared/bot-profile-types'

const table = '\n Profile          Model                        Gateway      Alias        Distribution\n ───────────────    ───────────────────────────    ───────────    ───────────    ────────────────────\n ◆default         claude-sonnet-5-5            running      —            —\n  a2z             claude-sonnet-5-5            stopped      —            —\n'
const dsh: BotProfile = { key: 'dsh:C:\\Profiles One:ra-dev', id: 'ra-dev', label: 'DSH / ra-dev', source: 'dsh', home: 'C:\\Profiles One', application: 'unverified application' }
describe('bot catalogue and launches', () => {
  it('keeps canonical IDs while removing the current marker and ANSI escapes', () => {
    expect(parseHermesProfiles(`\x1b[32m${table}\x1b[0m`).map((p) => [p.key, p.id])).toEqual([
      ['hermes:hermes@100.65.84.89:default', 'default'], ['hermes:hermes@100.65.84.89:a2z', 'a2z']
    ])
  })
  it.each(['SSH refused', 'Profile Model Gateway\n default unknown', table.replace('stopped', 'unknown')])('rejects unrecognized discovery output', (output) => {
    expect(() => parseHermesProfiles(output)).toThrow()
  })
  it.each(['x;whoami', '../default', 'x"', 'x$(whoami)', '-default'])('rejects unsafe profile IDs %s at the launch boundary', (id) => {
    expect(() => buildBotLaunch({ ...dsh, id }, 'win32')).toThrow('Invalid bot profile')
  })
  it('keeps each DSH home in that terminal environment', () => {
    const first = buildBotLaunch(dsh, 'win32')
    const second = buildBotLaunch({ ...dsh, key: 'other', home: 'C:\\Profiles Two' }, 'win32')
    expect(first.env).toEqual({ DSH_HOME: 'C:\\Profiles One' })
    expect(second.env).toEqual({ DSH_HOME: 'C:\\Profiles Two' })
    expect(first.command).toBe("& dsh --profile 'ra-dev'")
  })
  it('pins Hermes to the hermes account and its explicit profile without changing the default', () => {
    const launch = buildBotLaunch(parseHermesProfiles(table)[0]!, 'win32')
    expect(launch.command).toContain("'hermes@100.65.84.89'")
    expect(launch.command).toContain("--profile ''default'' --tui")
    expect(launch.identity).toEqual({ key: 'hermes:hermes@100.65.84.89:default', id: 'default', source: 'hermes', home: '/home/hermes', remotePath: '/home/hermes' })
  })
  it('refuses to execute a Windows SSH key on a Linux host', () => {
    expect(() => buildBotLaunch(dsh, 'linux')).toThrow('local Windows desktop')
  })
})
