import { useSyncExternalStore } from 'react'

const consumers = new Set<symbol>()
const listeners = new Set<() => void>()
const notify = (): void => listeners.forEach((listener) => listener())
const getSnapshot = (): boolean => consumers.size > 0
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// RA: visible popovers keep the shared scanner alive without adding idle polls.
export function acquireWorkspacePortScanDemand(): () => void {
  const token = Symbol()
  consumers.add(token)
  notify()
  return () => {
    consumers.delete(token)
    notify()
  }
}

export function useWorkspacePortScanDemand(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
