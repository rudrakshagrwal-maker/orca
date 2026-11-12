import { randomUUID } from 'node:crypto'
import { AgentBrowserBridge } from '../browser/agent-browser/agent-browser-bridge'
import { EmulatorBridge } from '../emulator/emulator-bridge'
import { RpcDispatcher } from '../runtime/rpc/dispatcher'
import { DESKTOP_RPC_CALLER, LOCAL_CLI_RPC_CALLER } from '../runtime/rpc/rpc-caller-identity'
import { browserManager } from '../browser/guest-lifecycle/manager/browser-manager'
import { configureBrowserClientPageAutomationRuntime } from '../browser/client-pages/execution/browser-client-page-automation-runtime'
import { BrowserExpectedUrlMismatch } from '../../shared/browser/client-hosting/browser-expected-url'
import { BrowserClientPageCommandError } from '../browser/client-pages/execution/browser-client-page-command-failure'
import { ALL_RPC_METHODS } from '../runtime/rpc/methods/rpc-method-registry'
import { mainProcessState as state } from './main-process-state'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'

// RA: load this runtime only when embedded browser/emulator features are enabled.
export function initializeMainProcessBrowserRuntime(runtime: OrcaRuntimeService): void {
  state.agentBrowserBridge = new AgentBrowserBridge(browserManager, {
    onTabsChanged: (worktreeId) => runtime.notifyMobileSessionTabsChanged(worktreeId)
  })
  runtime.setAgentBrowserBridge(state.agentBrowserBridge)
  // Reclaim browser daemons orphaned by prior crashes/SIGKILL.
  void state.agentBrowserBridge.sweepOrphanedSessions()
  const browserClientAutomationDispatcher = new RpcDispatcher({ runtime, methods: ALL_RPC_METHODS })
  configureBrowserClientPageAutomationRuntime({
    browserManager,
    getAgentBrowserBridge: () => state.agentBrowserBridge,
    executeRpc: async (method, params, agent, signal) => {
      const response = await browserClientAutomationDispatcher.dispatch(
        { id: randomUUID(), authToken: 'local-browser-client-automation', method, params },
        // Why: the cursor, glow and tab badge key off an agent caller; relayed people are not one.
        { signal, caller: agent ? LOCAL_CLI_RPC_CALLER : DESKTOP_RPC_CALLER }
      )
      if (!response.ok) {
        const mismatch = BrowserExpectedUrlMismatch.safeParse(response.error.data)
        throw new BrowserClientPageCommandError(response.error.code, {
          expectedUrlMismatch: mismatch.success ? mismatch.data : undefined
        })
      }
      return response.result
    }
  })
  // Only Orca-managed emulator helpers belong to workspaces; external serve-sim stays independent. macOS capability gates live in CLI/runtime.
  state.emulatorBridge = new EmulatorBridge()
  runtime.setEmulatorBridge(state.emulatorBridge)
}
