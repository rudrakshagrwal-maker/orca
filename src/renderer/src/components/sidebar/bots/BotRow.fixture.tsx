import { defineFixture } from '../../../component-fixtures/component-fixture'
import { BotRow } from './BotRow'
import type { BotProfile } from '../../../../../shared/bot-profile-types'

const now = 1794654000000
const profiles: BotProfile[] = [
  {
    key: 'writer',
    id: 'writer',
    label: 'Writer',
    source: 'hermes',
    application: 'local TUI',
    home: '/local/writer',
    chats: [
      {
        id: 'current',
        title: 'Product launch notes',
        preview: 'The headline and product copy are ready for review.',
        updatedAt: now - 60000
      },
      {
        id: 'earlier',
        title: 'Earlier conversation with a long title that should truncate',
        preview: 'First draft ready.',
        updatedAt: now - 3600000
      }
    ]
  },
  {
    key: 'research',
    id: 'research',
    label: 'Research and market intelligence',
    source: 'hermes',
    application: 'local TUI',
    home: '/local/research',
    chats: [
      {
        id: 'research-chat',
        title: 'Market overview',
        preview: 'I compared the competitors and their distribution.',
        updatedAt: now - 7200000
      }
    ]
  },
  {
    key: 'default',
    id: 'default',
    label: 'Hermes',
    source: 'hermes',
    application: 'local TUI',
    home: '/local/hermes',
    chats: []
  }
]
const open = async () => {}
const render = () => (
  <section className="bg-sidebar p-1 text-sidebar-foreground">
    <div className="px-2 py-1 text-[13px] font-medium">Bots</div>
    {profiles.map((profile) => (
      <BotRow key={profile.key} profile={profile} now={now} onOpen={open} onTerminal={open} />
    ))}
  </section>
)
export const contacts = defineFixture({ width: 320, render })
export const narrow = defineFixture({ width: 240, render })
export const recentChats = defineFixture({
  width: 320,
  render,
  interact(frame) {
    frame.querySelector<HTMLButtonElement>('[aria-label="Recent chats with Writer"]')?.click()
  }
})
