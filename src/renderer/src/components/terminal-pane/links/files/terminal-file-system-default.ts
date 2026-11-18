import type { ExecutionHostId } from '../../../../../../shared/execution-host'
import type { FileOpenFailure } from './terminal-file-open-failure'

// RA: pictures, video, audio, PDFs and Office files open in their Windows default app; code goes to VS Code.
const SYSTEM_DEFAULT_FILE_RE =
  /\.(png|jpe?g|gif|webp|bmp|ico|svg|avif|heic|tiff?|mp4|mov|mkv|webm|avi|mp3|wav|m4a|flac|ogg|pdf|docx?|xlsx?|pptx?)$/i

export function opensWithSystemDefault(filePath: string): boolean {
  return SYSTEM_DEFAULT_FILE_RE.test(filePath)
}

export async function openLinkWithRaDefaults(args: {
  path: string
  ownerHostId: ExecutionHostId
  clientLocal: boolean
  connectionId?: string | null
  onOpenFailure?: (failure: FileOpenFailure) => void
}): Promise<void> {
  if (args.clientLocal && opensWithSystemDefault(args.path)) {
    await window.api.shell.openPath(args.path, args.ownerHostId)
    return
  }
  const result = await window.api.shell.openInExternalEditor({
    path: args.path,
    builtInEditorId: 'vscode',
    ownerHostId: args.ownerHostId,
    connectionId: args.connectionId
  })
  if (!result.ok) {
    args.onOpenFailure?.({ verdict: 'unavailable', error: result.reason })
  }
}
