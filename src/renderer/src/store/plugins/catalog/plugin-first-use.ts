// RA: ambient font/theme/palette hooks cannot activate the plugin service on startup.
let opened = false
const deferred = new Set<() => void>()

export function deferUntilPluginsOpened(start: () => void): boolean {
  if (opened) return false
  deferred.add(start)
  return true
}

export function markPluginsOpened(): void {
  if (opened) return
  opened = true
  const starts = [...deferred]
  deferred.clear()
  for (const start of starts) start()
}
