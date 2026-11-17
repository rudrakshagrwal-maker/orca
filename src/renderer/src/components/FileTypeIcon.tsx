import { createElement, type CSSProperties } from 'react'
import { Folder, FolderOpen } from 'lucide-react'
import { getFileTypeIcon } from '@/lib/file-icons/file-type-icons'
type IconProps = { className?: string; style?: CSSProperties }
// RA: file icons use the built-in glyphs without plugin registration.
export function FileTypeIcon({
  filePath,
  className,
  style
}: IconProps & { filePath: string | null | undefined }): React.JSX.Element {
  return createElement(getFileTypeIcon(filePath), { 'aria-hidden': true, className, style })
}
export function FolderIcon({
  open,
  className,
  style
}: IconProps & { folderPath?: string; open: boolean }): React.JSX.Element {
  return createElement(open ? FolderOpen : Folder, { 'aria-hidden': true, className, style })
}
