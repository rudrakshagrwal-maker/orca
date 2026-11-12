import { useGitStatusPolling } from '../components/right-sidebar/source-control/sync/useGitStatusPolling'
import { useEditorExternalWatch } from '../hooks/useEditorExternalWatch'

// RA: one watcher owner across split editors; unmount as soon as no restored consumer is visible.
export default function ActiveEditorSourceControlSync(): null {
  useGitStatusPolling()
  useEditorExternalWatch()
  return null
}
