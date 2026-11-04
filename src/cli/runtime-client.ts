export { RuntimeClient } from './runtime/client'
// RA: reading terminals must not load the headless server and launch dependency graph.
export async function serveOrcaApp(
  ...args: Parameters<typeof import('./runtime/launch').serveOrcaApp>
): Promise<number> {
  return (await import('./runtime/launch.js')).serveOrcaApp(...args)
}
export { getDefaultUserDataPath } from './runtime/metadata'
export {
  RuntimeClientError,
  RuntimeRpcFailureError,
  type RuntimeRpcFailure,
  type RuntimeRpcResponse,
  type RuntimeRpcSuccess
} from './runtime/types'
