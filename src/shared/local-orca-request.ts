// RA: Orca services may contact only local daemons; browser guest partitions are independent.
export function isLocalOrcaRequest(value: string): boolean {
  try {
    const url = new URL(value)
    if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
      return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    }
    return [
      'file:',
      'data:',
      'blob:',
      'devtools:',
      'chrome-extension:',
      'orca:',
      'about:'
    ].includes(url.protocol)
  } catch {
    return false
  }
}
