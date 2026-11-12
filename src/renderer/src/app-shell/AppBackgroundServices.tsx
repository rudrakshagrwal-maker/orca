import { AgentHibernationGate } from '../components/AgentHibernationGate'
import RetainedAgentsSyncGate from '../components/dashboard/RetainedAgentsSyncGate'
import { SavedHostScopeWidenGate } from '../components/sidebar/worktree-list/listing/SavedHostScopeWidenGate'
import { ActiveWorkspaceSyncGate } from './ActiveWorkspaceSyncGate'

/** Isolate high-churn subscriptions from App rendering; services outlive their consuming surfaces. */
export function AppBackgroundServices(): React.JSX.Element {
  // RA: keep terminal/workspace synchronization without chat, browser, ports or popout services.
  return (
    <>
      <ActiveWorkspaceSyncGate />
      {/* Keep agent-status retention subscriptions out of the App render tree. */}
      <RetainedAgentsSyncGate />
      {/* RA: no background AI Vault session scans for tab titles. */}
      <SavedHostScopeWidenGate />
      <AgentHibernationGate />
    </>
  )
}
