import { X } from 'lucide-react'
import { translate } from '@/i18n/i18n'

export function EditorFileTabCloseButton({
  showsSelectionChrome,
  onClose
}: {
  showsSelectionChrome: boolean
  onClose: () => void
}): React.JSX.Element {
  return (
    <button
      // RA: Active tabs always expose close, including dirty files; inactive buttons take no title space.
      className={`items-center justify-center w-4 h-4 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted ${
        showsSelectionChrome ? 'flex' : 'hidden group-hover:flex group-focus-within:flex'
      }`}
      type="button"
      // Share the real close affordance with simulator tabs so E2E exercises their actual button.
      data-tab-close-button="true"
      aria-label={translate(
        'auto.components.tab.bar.EditorFileTabCloseButton.4655cf570e',
        'Close tab'
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <X className="w-3 h-3" />
    </button>
  )
}
