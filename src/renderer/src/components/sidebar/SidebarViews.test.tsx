// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { SidebarViews } from './SidebarViews'

const activateSearch = vi.hoisted(() => vi.fn())
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  return {
    useAppStore: create<{
      sidebarView: string
      setSidebarView: (sidebarView: string) => void
    }>((set) => ({
      sidebarView: 'projects',
      setSidebarView: (sidebarView) => set({ sidebarView })
    }))
  }
})
vi.mock('@/i18n/use-translate', () => ({
  useTranslate: () => (_key: string, fallback: string) => fallback
}))
vi.mock('./SidebarFilesSection', () => ({ SidebarFilesSection: () => <div>File tree</div> }))
vi.mock('../session-search/SessionSearchPanel', async () => {
  const { useEffect } = await import('react')
  return {
    default: function Search() {
      useEffect(() => {
        activateSearch()
      }, [])
      return <div>Chat results</div>
    }
  }
})
afterEach(cleanup)

it('mounts only the selected panel and activates chat search only when opened', async () => {
  useAppStore.setState({ sidebarView: 'projects' })
  render(
    <SidebarViews>
      <div>Project cards</div>
    </SidebarViews>
  )
  expect(screen.queryByText('Project cards')).not.toBeNull()
  expect(screen.queryByText('File tree')).toBeNull()
  expect(screen.queryByText('Chat results')).toBeNull()
  expect(activateSearch).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('radio', { name: 'Files' }))
  expect(screen.queryByText('Project cards')).toBeNull()
  expect(screen.queryByText('File tree')).not.toBeNull()
  expect(activateSearch).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('radio', { name: 'Search' }))
  await waitFor(() => expect(screen.queryByText('Chat results')).not.toBeNull())
  expect(screen.queryByText('Project cards')).toBeNull()
  expect(screen.queryByText('File tree')).toBeNull()
  expect(activateSearch).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('radio', { name: 'Projects' }))
  expect(screen.queryByText('Chat results')).toBeNull()
  expect(screen.queryByText('Project cards')).not.toBeNull()
})
