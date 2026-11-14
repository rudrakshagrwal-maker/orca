// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BotRow } from './BotRow'
import type { BotProfile } from '../../../../../shared/bot-profile-types'

const profile: BotProfile = {
  key: 'hermes:local:writer',
  id: 'writer',
  label: 'Writer',
  source: 'hermes',
  application: 'local TUI',
  home: '/local/hermes/profiles/writer',
  chats: [
    { id: 'recent', title: 'Launch plan', preview: 'Ready to ship', updatedAt: 100000 },
    { id: 'earlier', title: 'Earlier conversation', preview: 'Draft ready', updatedAt: 50000 }
  ]
}
afterEach(cleanup)
function row(onOpen = vi.fn().mockResolvedValue(undefined)) {
  return {
    onOpen,
    view: render(
      <TooltipProvider>
        <BotRow profile={profile} now={160000} onOpen={onOpen} />
      </TooltipProvider>
    )
  }
}
describe('bot row actions', () => {
  it('opens the newest chat from the contact row', async () => {
    const { view, onOpen } = row()
    fireEvent.click(view.getByRole('button', { name: 'Open Writer' }))
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(profile, undefined))
  })
  it('expands chat history independently and resumes the selected chat', async () => {
    const { view, onOpen } = row()
    expect(view.queryByRole('button', { name: /Earlier conversation/ })).toBeNull()
    fireEvent.click(view.getByRole('button', { name: 'Recent chats with Writer' }))
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(view.getByRole('button', { name: /Earlier conversation/ }))
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(profile, 'earlier'))
  })
  it('starts a new chat without resuming the newest session', async () => {
    const { view, onOpen } = row()
    fireEvent.click(view.getByRole('button', { name: 'New chat with Writer' }))
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(profile, null))
  })
  it('surfaces launch errors and lets the user retry', async () => {
    const open = vi
      .fn()
      .mockRejectedValueOnce(new Error('Select a local workspace'))
      .mockResolvedValue(undefined)
    const { view } = row(open)
    fireEvent.click(view.getByRole('button', { name: 'Open Writer' }))
    await waitFor(() =>
      expect(view.getByRole('alert').textContent).toBe('Select a local workspace')
    )
    fireEvent.click(view.getByRole('button', { name: 'Open Writer' }))
    await waitFor(() => expect(view.queryByRole('alert')).toBeNull())
  })
})
