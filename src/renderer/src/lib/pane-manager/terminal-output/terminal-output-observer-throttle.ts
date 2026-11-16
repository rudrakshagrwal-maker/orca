// RA: keep only the latest observation; spinner titles must not fan out through stores per chunk.
export function throttleTerminalOutputObserver<T extends unknown[]>(
  observe: (...args: T) => void,
  isDisposed: () => boolean
): (...args: T) => void {
  let lastAt = -Infinity
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: T | null = null
  const emit = (): void => {
    timer = null
    const args = pending
    pending = null
    if (args && !isDisposed()) {
      lastAt = Date.now()
      observe(...args)
    }
  }
  return (...args) => {
    if (isDisposed()) {
      return
    }
    pending = args
    if (timer !== null) {
      return
    }
    const delay = Math.max(0, 250 - (Date.now() - lastAt))
    if (delay === 0) {
      emit()
    } else {
      timer = setTimeout(emit, delay)
    }
  }
}
