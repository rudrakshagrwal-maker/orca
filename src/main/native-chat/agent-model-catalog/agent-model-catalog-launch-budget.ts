import { refreshAgentModelCatalogListing } from './agent-model-catalog-lister'
import { agentModelCatalogEntryIsStale } from './agent-model-catalog-entry-lifetime'
import { isForkTuiAgent } from '../../../shared/agent-launch/catalog/tui-agent'
import type { AgentModelCatalogEntry } from './agent-model-catalog-entry'

// RA: even failures consume the launch attempt; only explicit refresh resets it.
export class AgentModelCatalogLaunchBudget {
  private readonly attempts = new Map<
    string,
    { fingerprint: string; listed: boolean; promise: Promise<AgentModelCatalogEntry | null> }
  >()

  constructor(private readonly enabled = true) {}

  isStale(entry: AgentModelCatalogEntry, due: boolean, now: number): boolean {
    const attempt = this.attempts.get(entry.agent)
    const discoveredHere =
      this.enabled && attempt?.fingerprint === entry.fingerprint && attempt.listed
    return due || (!discoveredHere && agentModelCatalogEntryIsStale(entry, due, now))
  }

  reset(agent: string): void {
    this.attempts.delete(agent)
  }

  refresh(
    input: Parameters<typeof refreshAgentModelCatalogListing>[0],
    saved: () => AgentModelCatalogEntry | null
  ): Promise<AgentModelCatalogEntry | null> {
    const { agent, fingerprint } = input
    const run = () => refreshAgentModelCatalogListing(input)
    if (!this.enabled) {
      return run()
    }
    if (!isForkTuiAgent(agent)) {
      return Promise.resolve(null)
    }
    const existing = this.attempts.get(agent)
    if (existing) {
      // Never reuse another account's result as proof for this one.
      return existing.fingerprint === fingerprint ? existing.promise : Promise.resolve(saved())
    }
    const promise = run()
    const attempt = { fingerprint, promise, listed: false }
    this.attempts.set(agent, attempt)
    void promise.then((entry) => {
      attempt.listed = entry?.discovered !== undefined
    })
    return promise
  }
}
