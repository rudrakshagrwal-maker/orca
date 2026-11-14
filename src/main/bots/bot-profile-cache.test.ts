import { afterEach, describe, expect, it, vi } from 'vitest'
const read = vi.hoisted(() => vi.fn())
vi.mock('node:fs', () => ({
  existsSync: () => true,
  lstatSync: () => ({ isFile: () => true, isSymbolicLink: () => false }),
  statSync: () => ({ isDirectory: () => true })
}))
vi.mock('node:fs/promises', () => ({ readdir: () => [], readFile: () => Promise.resolve('') }))
vi.mock('./hermes-chat-reader', () => ({ readHermesChats: read }))
import { getBotProfiles } from './bot-profile-catalog'

afterEach(() => vi.restoreAllMocks())
describe('bot catalogue cache', () => {
  it('keeps the last successful snapshot until explicitly refreshed', async () => {
    read.mockReturnValue([{ id: 'first', title: 'First', preview: 'Hello', updatedAt: 100 }])
    const first = await getBotProfiles(true)
    read.mockReturnValue([{ id: 'second', title: 'Second', preview: 'World', updatedAt: 200 }])
    expect((await getBotProfiles()).profiles[0]?.chats?.[0]?.id).toBe('first')
    expect((await getBotProfiles(true)).profiles[0]?.chats?.[0]?.id).toBe('second')
    expect(first.profiles[0]?.chats?.[0]?.id).toBe('first')
  })
})
