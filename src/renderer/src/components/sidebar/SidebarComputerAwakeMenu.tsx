import { useEffect, useRef, useState } from 'react'
import { Coffee } from 'lucide-react'
import { toast } from 'sonner'
import {
  computerAwakeSettingsForMode,
  type ComputerAwakeMode,
  type ComputerAwakeStatus
} from '../../../../shared/computer-awake-mode'
import { useAppStore } from '@/store/index'
import { useMountedRef } from '@/hooks/useMountedRef'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  getAgentAwakeModeLabel,
  getAgentAwakeTitle
} from '@/components/settings/agents/behavior/agent-awake-copy'

export function SidebarComputerAwakeMenu(): React.JSX.Element {
  const t = useTranslate()
  const updateSettings = useAppStore((state) => state.updateSettingsOrThrow)
  const [status, setStatus] = useState<ComputerAwakeStatus | null>(null)
  const [saving, setSaving] = useState(false)
  const mountedRef = useMountedRef()
  const statusVersion = useRef(0)

  useEffect(() => {
    let disposed = false
    const version = statusVersion.current
    const unsubscribe = window.api.agentAwake.onChanged((nextStatus) => {
      statusVersion.current += 1
      setStatus(nextStatus)
    })
    void window.api.agentAwake.getStatus().then(
      (nextStatus) => {
        // A pushed status is newer than the initial IPC snapshot.
        if (!disposed && version === statusVersion.current) {
          setStatus(nextStatus)
        }
      },
      (error) => console.error('Failed to read computer awake status:', error)
    )
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  const options: { mode: ComputerAwakeMode; label: string }[] = [
    { mode: 'off', label: getAgentAwakeModeLabel('off', t) },
    {
      mode: 'auto',
      label: t('auto.components.settings.agent-awake-copy.whileAgentsWork', 'While agents work')
    },
    { mode: 'on', label: t('auto.components.settings.agent-awake-copy.always', 'Always') }
  ]
  const modeLabel = options.find((option) => option.mode === status?.mode)?.label
  const label = modeLabel ? `${getAgentAwakeTitle(t)}: ${modeLabel}` : getAgentAwakeTitle(t)

  const setMode = async (mode: ComputerAwakeMode): Promise<void> => {
    setSaving(true)
    try {
      await updateSettings(computerAwakeSettingsForMode(mode))
      const version = statusVersion.current
      const nextStatus = await window.api.agentAwake.getStatus()
      if (mountedRef.current && version === statusVersion.current) {
        setStatus(nextStatus)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      if (mountedRef.current) {
        setSaving(false)
      }
    }
  }

  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              aria-label={label}
              disabled={!status || saving}
            >
              <Coffee
                className={cn(
                  'size-3.5',
                  status?.active ? 'text-foreground' : 'text-muted-foreground'
                )}
              />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="top" align="start" sideOffset={8}>
        <DropdownMenuRadioGroup value={status?.mode}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.mode}
              value={option.mode}
              disabled={saving}
              onSelect={() => void setMode(option.mode)}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
