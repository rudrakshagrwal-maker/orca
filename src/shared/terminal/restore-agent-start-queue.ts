// RA: restore agents serially, prioritizing the active tab without delaying plain shells.
export const RESTORED_AGENT_START_DELAY_MS = 150

type PendingStart = { active: () => boolean; run: () => Promise<void> }

export class RestoreAgentStartQueue {
  private pending: PendingStart[] = []
  private running = false

  run<T>(agent: string | undefined, active: () => boolean, start: () => Promise<T>): Promise<T> {
    if (agent !== 'claude' && agent !== 'codex') {
      return start()
    }
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        active,
        run: async () => {
          try {
            resolve(await start())
          } catch (error) {
            reject(error)
          }
        }
      })
      if (!this.running) {
        this.running = true
        // RA: collect the mounting panes before selecting the active tab's first start.
        setTimeout(() => void this.drain(), 0)
      }
    })
  }

  private async drain(): Promise<void> {
    while (this.pending.length) {
      const activeIndex = this.pending.findIndex((entry) => entry.active())
      const [entry] = this.pending.splice(Math.max(0, activeIndex), 1)
      await entry.run()
      // RA: retain the gap for arrivals while the previous start settles, including failures.
      await new Promise<void>((resolve) => setTimeout(resolve, RESTORED_AGENT_START_DELAY_MS))
    }
    this.running = false
  }
}

export const restoredAgentStarts = new RestoreAgentStartQueue()
