// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest'
import {
  applyExpandedLayoutTo,
  restoreExpandedLayoutFrom
} from '@/components/terminal-pane/layout/expand/expanded-pane-layout'
import {
  flushTerminalOutput,
  writeTerminalOutput
} from './terminal-output/pane-terminal-output-scheduler'

// RA: exercise real pane layout without opening canvas renderers in happy-dom.
vi.mock('./pane-lifecycle', async (importOriginal) => {
  const actual: object = await importOriginal()
  return { ...actual, openTerminal: vi.fn() }
})
const { PaneManager } = await import('./pane-manager')

it('buffers an expanded-away split through tab hide/reveal and replays it on collapse', () => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  const root = document.createElement('div')
  document.body.appendChild(root)
  const manager = new PaneManager(root, { linkOpenHint: () => '' })
  try {
    const first = manager.createInitialPane({ focus: false })
    manager.splitPane(first.id, 'vertical')
    const second = manager.getPanes().find((pane) => pane.id !== first.id)!
    let screen = ''
    vi.spyOn(second.terminal, 'write').mockImplementation((data, callback) => {
      screen += data
      callback?.()
    })
    const snapshots = new Map<HTMLElement, { display: string; flex: string }>()
    expect(
      applyExpandedLayoutTo(first.id, {
        managerRef: { current: manager },
        containerRef: { current: root },
        expandedStyleSnapshotRef: { current: snapshots }
      })
    ).toBe(true)
    writeTerminalOutput(second.terminal, 'hidden output\n', { foreground: true })
    manager.suspendRendering()
    manager.resumeRendering()
    flushTerminalOutput(second.terminal)
    vi.advanceTimersByTime(60_000)
    expect(screen).toBe('')
    restoreExpandedLayoutFrom(snapshots, manager)
    flushTerminalOutput(second.terminal)
    expect(screen).toBe('hidden output\n')
  } finally {
    manager.destroy()
    root.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  }
})
