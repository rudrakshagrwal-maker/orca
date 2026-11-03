// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SidebarSettingsHelpMenu } from './SidebarSettingsHelpMenu'

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  openSettingsPage: vi.fn(),
  openSettingsTarget: vi.fn(),
  appRestart: vi.fn(),
  updaterCheck: vi.fn(),
  shellOpenUrl: vi.fn(),
  useShortcutKeyDetails: vi.fn(),
  feedbackChunkLoads: 0,
  setupProgress: {
    ready: true,
    coreDoneCount: 2,
    coreTotal: 5,
    stepDone: {}
  }
}))

let updateStatus = { state: 'idle' } as const
const roots: Root[] = []

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      openModal: mocks.openModal,
      openSettingsPage: mocks.openSettingsPage,
      openSettingsTarget: mocks.openSettingsTarget,
      updateStatus
    })
}))

vi.mock('@/hooks/useShortcutLabel', () => ({
  useShortcutKeyDetails: mocks.useShortcutKeyDetails
}))

vi.mock('@/hooks/useMountedRef', () => ({
  useMountedRef: () => ({ current: true })
}))

vi.mock('../onboarding/show-onboarding-event', () => ({
  showOnboardingFromRenderer: vi.fn()
}))

vi.mock('../setup-guide/use-setup-guide-progress', () => ({
  useSetupGuideProgress: () => mocks.setupProgress
}))

vi.mock('../setup-guide/SetupGuideProgressRing', () => ({
  SetupGuideProgressRing: () => <span data-testid="setup-guide-progress-ring" />
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({
    children,
    onOpenChange
  }: {
    children: ReactNode
    onOpenChange?: (open: boolean) => void
  }) => (
    <>
      <button data-testid="open-menu" onClick={() => onOpenChange?.(true)} />
      {children}
    </>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({
    children,
    disabled,
    onPointerDown,
    onSelect,
    title
  }: {
    children: ReactNode
    disabled?: boolean
    onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void
    onSelect?: (event: Event) => void
    title?: string
  }) => (
    <button
      data-testid="menu-item"
      disabled={disabled}
      onClick={() => onSelect?.(new Event('menu.itemSelect'))}
      onPointerDown={onPointerDown}
      title={title}
    >
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    'aria-label': ariaLabel
  }: {
    children: ReactNode
    onClick?: (event: React.MouseEvent) => void
    'aria-label'?: string
  }) => (
    <button data-testid="trigger-button" aria-label={ariaLabel} onClick={onClick}>
      {children}
    </button>
  )
}))

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('./SidebarFeedbackDialog', () => {
  mocks.feedbackChunkLoads += 1
  return { SidebarFeedbackDialog: () => <div data-testid="feedback-dialog" /> }
})

function installWindowApi(): void {
  Object.assign(window, {
    api: {
      app: {
        restart: mocks.appRestart
      },
      shell: {
        openUrl: mocks.shellOpenUrl
      },
      updater: {
        check: mocks.updaterCheck
      }
    }
  })
}

async function renderMenu(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)

  await act(async () => {
    root.render(<SidebarSettingsHelpMenu />)
  })

  return container
}

function findMenuItem(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(
    container.querySelectorAll<HTMLButtonElement>('[data-testid="menu-item"]')
  ).find((element) => element.textContent?.includes(label))
  expect(button).toBeDefined()
  return button as HTMLButtonElement
}

describe('SidebarSettingsHelpMenu', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.clearAllMocks()
    installWindowApi()
    mocks.useShortcutKeyDetails.mockReturnValue({ keys: ['⌘', ','], doubleTap: false })
    updateStatus = { state: 'idle' }
    mocks.setupProgress = {
      ready: true,
      coreDoneCount: 2,
      coreTotal: 5,
      stepDone: {}
    }
  })

  afterEach(() => {
    roots.splice(0).forEach((root) => {
      act(() => root.unmount())
    })
    document.body.replaceChildren()
  })

  it('renders the help button with correct aria-label', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).toContain('Help')
  })

  it('renders the settings button with correct aria-label', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).toContain('aria-label="Settings"')
  })

  it('renders the settings button before the help button', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    const settingsIndex = html.indexOf('lucide-settings')
    const helpIndex = html.indexOf('lucide-circle-question-mark')
    expect(settingsIndex).toBeGreaterThanOrEqual(0)
    expect(helpIndex).toBeGreaterThan(settingsIndex)
  })

  // RA: disabled automatic/feedback surfaces have no help-menu entry.
  it('omits Send Feedback', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).not.toContain('Send Feedback')
  })

  it('renders Keyboard Shortcuts menu item', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).toContain('Keyboard Shortcuts')
  })

  // RA: disabled automatic/feedback surfaces have no help-menu entry.
  it('omits incomplete setup milestones', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).not.toContain('Milestones')
    expect(html).not.toContain('data-testid="setup-guide-progress-ring"')
  })

  it('hides Milestones when setup is complete', () => {
    mocks.setupProgress = {
      ready: true,
      coreDoneCount: 5,
      coreTotal: 5,
      stepDone: {}
    }
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).not.toContain('Milestones')
  })

  // RA: disabled automatic/feedback surfaces have no help-menu entry.
  it('omits the onboarding menu item', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).not.toContain('Onboarding')
  })

  it('renders Restart Orca by default', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).toContain('Restart Orca')
  })

  it('renders Docs link', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).toContain('Docs')
  })

  it('renders Changelog link', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).toContain('Changelog')
  })

  it('renders GitHub link', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).toContain('GitHub')
  })

  it('renders Discord link', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).toContain('Discord')
    expect(html).toContain('viewBox="0 0 20 20"')
    expect(html).toContain('M16.0742 4.45014C14.9244 3.92097 13.7106 3.54556 12.4638 3.3335')
  })

  it('opens the Discord invite when no workspace browser can host it', async () => {
    const container = await renderMenu()
    const discordButton = findMenuItem(container, 'Discord')

    await act(async () => {
      discordButton.click()
    })

    expect(mocks.shellOpenUrl).toHaveBeenCalledWith('https://discord.gg/fzjDKHxv8Q')
  })

  it('renders X link', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).toContain('>X<')
  })

  it('omits update checks from Help', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).not.toContain('Check for Updates')
  })

  it('does not check for updates when Help opens', async () => {
    const container = await renderMenu()
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="open-menu"]')?.click()
    })
    expect(mocks.updaterCheck).not.toHaveBeenCalled()
  })

  it('does not preload feedback when Help opens', async () => {
    const container = await renderMenu()
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="open-menu"]')?.click()
    })
    expect(mocks.feedbackChunkLoads).toBe(0)
  })

  it('renders shortcut keys in the settings tooltip', () => {
    const html = renderToStaticMarkup(<SidebarSettingsHelpMenu />)
    expect(html).toContain('⌘')
    expect(html).toContain('>,</span>')
  })
})
