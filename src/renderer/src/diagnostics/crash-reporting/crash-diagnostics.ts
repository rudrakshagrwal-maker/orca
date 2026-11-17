import { compactBreadcrumbData, describeUnknownValue } from './crash-breadcrumb-data'
import { recordRendererCrashBreadcrumb } from './crash-breadcrumb-recorder'
// RA: crash listeners retain local evidence without periodic memory sampling.
export type RendererSurface = 'main' | 'dashboard-popout'

let rendererCrashDiagnosticsInstalled = false

export function installRendererCrashDiagnostics(surface: RendererSurface = 'main'): void {
  if (rendererCrashDiagnosticsInstalled || typeof window === 'undefined') {
    return
  }

  rendererCrashDiagnosticsInstalled = true
  void surface
  window.addEventListener('error', recordRendererError)
  window.addEventListener('unhandledrejection', recordRendererUnhandledRejection)
}

function disposeRendererCrashDiagnostics(): void {
  if (!rendererCrashDiagnosticsInstalled || typeof window === 'undefined') {
    return
  }
  rendererCrashDiagnosticsInstalled = false
  window.removeEventListener('error', recordRendererError)
  window.removeEventListener('unhandledrejection', recordRendererUnhandledRejection)
}

if (import.meta !== undefined && import.meta.hot) {
  // Remove global hooks on Vite replacement so HMR cannot accumulate diagnostics listeners.
  import.meta.hot.dispose(disposeRendererCrashDiagnostics)
}

function recordRendererError(event: ErrorEvent): void {
  // Ignore benign self-resolving ResizeObserver loop errors; recording them floods evidence and increases heap use (#8260).
  if (
    /^ResizeObserver loop (?:limit exceeded|completed with undelivered notifications)\.?$/i.test(
      event.message
    )
  ) {
    event.preventDefault()
    return
  }
  recordRendererCrashBreadcrumb(
    'renderer_error',
    compactBreadcrumbData({
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      ...describeUnknownValue('error', event.error)
    })
  )
}

function recordRendererUnhandledRejection(event: PromiseRejectionEvent): void {
  recordRendererCrashBreadcrumb(
    'renderer_unhandled_rejection',
    compactBreadcrumbData(describeUnknownValue('reason', event.reason))
  )
}
