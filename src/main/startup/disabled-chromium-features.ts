// Avoid Electron imports so real-runtime probes can reuse the shipped feature list.
export const DISABLED_CHROMIUM_FEATURES = [
  // RA: do not reserve an unused renderer process ahead of browser navigation.
  'SpareRendererForSitePerProcess',
  'FedCm',
  // Electron has no DirectSocketsDelegate; exposed constructors kill guest renderers via ReportBadMessage instead of connecting.
  'DirectSockets',
  'DirectSocketsInSharedWorkers',
  'DirectSocketsInServiceWorkers'
] as const
