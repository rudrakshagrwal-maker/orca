// RA: System admission metadata only, never prompts or credentials.
export type WorkerRamQueueRow = {
  id: string
  worktreeId: string
  parentHandle?: string
  label: string
  percent: number
  queuedAt: number
}
export function workerRamLimit(value?: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(90, Math.max(70, value)) : 80
}
