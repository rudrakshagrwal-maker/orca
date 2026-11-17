// RA: Remove unused surfaces and their startup dependencies from the lean fork.
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { isTrustedMainRendererSender } from '../ipc/main-renderer-sender-trust'

let trustedClipboardRendererWebContentsId: number | null = null

export function setTrustedClipboardRendererWebContentsId(webContentsId: number | null): void {
  trustedClipboardRendererWebContentsId = webContentsId
}

export function assertTrustedClipboardSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedClipboardRenderer(event.sender)) {
    throw new Error('Unauthorized clipboard IPC sender')
  }
}

export function assertTrustedClipboardTextSender(event: IpcMainInvokeEvent): void {
  // Dashboard popouts need text clipboard authority only; never extend it to images, files or remote operations.
  if (!isTrustedClipboardRenderer(event.sender)) {
    throw new Error('Unauthorized clipboard IPC sender')
  }
}

function isTrustedClipboardRenderer(sender: WebContents): boolean {
  return isTrustedMainRendererSender(sender, trustedClipboardRendererWebContentsId)
}
