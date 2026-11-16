// RA: Discovery failures must leave last-good profiles usable and keep their success timestamp.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ run: vi.fn(), read: vi.fn(), directories: vi.fn() }))
vi.mock('electron', () => ({ app: { getPath: () => 'C:/bot-cache' } }))
vi.mock('@orca/process-host', () => ({ runProcess: mocks.run }))
vi.mock('node:fs/promises', () => ({ readFile: mocks.read, readdir: mocks.directories, stat: vi.fn() }))
vi.mock('../persistence/atomic-snapshot-writer', () => ({ AtomicSnapshotWriter: class { write() { return Promise.resolve() } } })) // RA: tests never write a cache to disk.
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!
describe('last-good bot cache', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    mocks.read.mockResolvedValue(JSON.stringify({ lastSuccess: 123, profiles: [{ source: 'hermes', id: 'default', label: 'Hermes / default' }] }))
    mocks.directories.mockResolvedValue([])
  })
  afterEach(() => { Object.defineProperty(process, 'platform', originalPlatform) })
  it('returns cached canonical profiles without an SSH refresh', async () => {
    const { getBotProfiles } = await import('./bot-profile-catalog')
    const snapshot = await getBotProfiles()
    expect(snapshot).toEqual({ profiles: [{ key: 'hermes:hermes@100.65.84.89:default', id: 'default', label: 'Hermes / default', source: 'hermes', home: '/home/hermes', application: 'remote TUI' }], lastSuccess: 123 })
  })
  it.each(['offline', 'unknown table'])('retains usable cache during %s discovery', async (failure) => {
    if (failure === 'offline') mocks.run.mockRejectedValue(new Error('VPN unavailable'))
    else mocks.run.mockResolvedValue({ code: 0, timedOut: false, stdout: 'Unknown profile output' })
    const { getBotProfiles } = await import('./bot-profile-catalog')
    const snapshot = await getBotProfiles(true)
    expect(snapshot.profiles.map((row) => row.id)).toEqual(['default'])
    expect(snapshot.lastSuccess).toBe(123)
    expect(snapshot.error).toBeTruthy()
  })
})
