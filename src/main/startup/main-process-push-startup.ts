// RA: local startup never constructs a push gateway client or registers phone notification tokens.
import type { OrcaRuntimeRpcServer } from '../runtime/rpc/server/runtime-rpc'
export function startDesktopPushService(_runtimeRpc: OrcaRuntimeRpcServer): void {}
