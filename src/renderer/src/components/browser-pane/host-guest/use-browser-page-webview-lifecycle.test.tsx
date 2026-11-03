// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useBrowserPageWebviewLifecycle } from './use-browser-page-webview-lifecycle'
import type { AttachBrowserPageWebviewArgs } from './attach-browser-page-webview'

const state = vi.hoisted(() => ({
  browserAnnotationsByPageId: {},
  browserAnnotationMarkerIdsByPageId: {},
  addBrowserHistoryEntry: vi.fn(),
  createBrowserTab: vi.fn()
}))
vi.mock('@/store', () => ({
  useAppStore: Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
}))
vi.mock('../annotate/guest-annotation-viewport-bridge', () => ({
  syncGuestAnnotationViewportBridge: vi.fn()
}))
vi.mock('./browser-page-webview', () => ({ setBrowserPageWebviewInputLock: vi.fn() }))

const guests = new Map<string, HTMLInputElement>()
vi.mock('./webview-registry', () => ({
  replacePersistentWebview: (id: string) => {
    guests.delete(id)
  }
}))
vi.mock('./attach-browser-page-webview', () => ({
  attachBrowserPageWebview: (args: AttachBrowserPageWebviewArgs) => {
    if (!guests.has(args.browserTabId)) {
      guests.set(args.browserTabId, document.createElement('input'))
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only identity is read; Electron methods are mocked at the attachment boundary.
    args.webviewRef.current = guests.get(args.browserTabId)! as unknown as Electron.WebviewTag
    return () => {
      args.webviewRef.current = null
    }
  }
}))

function inputs(): Parameters<typeof useBrowserPageWebviewLifecycle>[0] {
  return {
    browserTabId: 'page',
    browserTabUrl: 'https://example.com',
    browserTabLoading: false,
    browserTabLoadError: null,
    workspaceId: 'browser',
    worktreeId: 'workspace',
    sessionProfileId: null,
    webviewPartition: 'persist:test',
    isActive: false,
    isPaintable: false,
    slotViewport: null,
    viewportPresetId: null,
    addressBarInputRef: { current: null },
    addressBarValueRef: { current: '' },
    browserTabUrlRef: { current: 'https://example.com' },
    keepAddressBarFocusRef: { current: false },
    handleInternalFileDragOverRef: { current: vi.fn() },
    handleInternalFileDropRef: { current: vi.fn() },
    dismissAddressBarSuggestionsRef: { current: null },
    onUpdatePageState: vi.fn(),
    onSetUrl: vi.fn(),
    setAddressBarValue: vi.fn(),
    cancelPendingBrowserCapture: vi.fn(),
    setBrowserOverlayViewport: vi.fn(),
    setFindOpen: vi.fn(),
    focusAddressBarNow: () => false,
    focusWebviewNow: () => false,
    pendingAnnotationPayload: null,
    inputLocked: false,
    faviconUrl: null,
    webviewRef: { current: null },
    lastKnownWebviewUrlRef: { current: null },
    recoveryNavigationValidationRef: { current: null },
    activeLoadFailureRef: { current: null },
    retryGuestRecoveryRef: { current: vi.fn() },
    onUpdatePageStateRef: { current: vi.fn() },
    onSetUrlRef: { current: vi.fn() }
  }
}

afterEach(() => {
  cleanup()
  guests.clear()
})

it('creates unopened pages lazily and retains the loaded guest across ordinary switches', () => {
  const options = inputs()
  const view = renderHook(
    ({ visible }) => useBrowserPageWebviewLifecycle({
      ...options,
      isPaintable: visible,
      isActive: visible
    }),
    { initialProps: { visible: false } }
  )
  expect(guests.size).toBe(0)
  view.rerender({ visible: true })
  const guest = guests.get('page')!
  guest.value = 'unsaved form'
  view.rerender({ visible: false })
  expect(guests.get('page')).toBe(guest)
  view.rerender({ visible: true })
  expect(guests.get('page')).toBe(guest)
  expect(guest.value).toBe('unsaved form')
})
