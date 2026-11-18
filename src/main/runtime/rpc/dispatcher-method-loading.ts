import type { OrchestrationEntryCaller } from '../orchestration/addressing/orchestration-caller-identity'
import {
  buildRegistry,
  type RpcAnyMethodDeclaration,
  type RpcRegistry,
  type RpcRequest,
  type RpcMethod
} from './core'
import { withoutMethodsThisHostDoesNotServe } from './methods/terminal/session-terminal-scrollback'

export async function loadRpcMethodRegistry(
  load: (name: string) => Promise<readonly RpcAnyMethodDeclaration[]>,
  name: string,
  current: () => RpcRegistry
): Promise<RpcRegistry> {
  const methods = await load(name)
  // Read after await so simultaneous first requests retain each other's methods.
  return new Map([...current(), ...buildRegistry(withoutMethodsThisHostDoesNotServe(methods))])
}

export type AdmittedUnaryCall = {
  request: RpcRequest
  method: RpcMethod
  params: unknown
  caller: OrchestrationEntryCaller | undefined
}
