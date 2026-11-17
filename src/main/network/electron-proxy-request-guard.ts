import type { Session } from 'electron'
import { getProxySessionApplicationReadiness } from './proxy-settings'
import { isLocalOrcaRequest } from '../../shared/local-orca-request'

/** Hold default-session requests until the newest app-wide proxy transition settles. */
export function installElectronProxyRequestGuard(proxySession: Session): void {
  proxySession.webRequest.onBeforeRequest((details, callback) => {
    // RA: default app/update sessions cannot call outside; browser guest sessions keep browsing.
    if (!isLocalOrcaRequest(details.url)) {
      callback({ cancel: true })
      return
    }
    const readiness = getProxySessionApplicationReadiness(proxySession)
    const answer = (ready: boolean): void => callback(ready ? {} : { cancel: true })
    if (typeof readiness === 'boolean') {
      answer(readiness)
    } else {
      void readiness.then(answer)
    }
  })
}
