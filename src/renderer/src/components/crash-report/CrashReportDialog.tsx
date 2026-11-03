import { Suspense, useCallback, useEffect, useState } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazy-with-retry'
import { useMountedRef } from '@/hooks/useMountedRef'
import type { CrashReportRecord } from '../../../../shared/crash-reporting'

const CrashReportDialogSurface = lazy(() =>
  import('./CrashReportDialogSurface').then((module) => ({
    default: module.CrashReportDialogSurface
  }))
)

export function CrashReportDialog(): React.JSX.Element | null {
  const mountedRef = useMountedRef()
  const [open, setOpen] = useState(false)
  const [report, setReport] = useState<CrashReportRecord | null>(null)
  const [loading, setLoading] = useState(false)

  const loadCrashReport = useCallback(
    async (promptIfPresent: boolean): Promise<void> => {
      setLoading(true)
      try {
        const nextReport = promptIfPresent
          ? await window.api.crashReports.getLatestPending()
          : await window.api.crashReports.getLatestReport()
        let displayedReport = nextReport
        if (nextReport?.status === 'pending' && promptIfPresent) {
          try {
            // Dismiss startup prompts once; retain report data for immediate send and later reopening through Help.
            await window.api.crashReports.dismiss({ reportId: nextReport.id })
            displayedReport = { ...nextReport, status: 'dismissed' as const }
          } catch (error) {
            console.error('Failed to dismiss crash report after startup prompt:', error)
          }
        }
        if (!mountedRef.current) {
          return
        }
        setReport(displayedReport)
        if (nextReport && promptIfPresent) {
          setOpen(true)
        }
      } catch (error) {
        console.error('Failed to load crash report:', error)
      } finally {
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    },
    [mountedRef]
  )

  // RA: the crash dialog opens only from the explicit Help command.
  useEffect(() => {
    return window.api.ui.onOpenCrashReport(() => {
      setReport(null)
      setOpen(true)
      void loadCrashReport(false)
    })
  }, [loadCrashReport])

  if (!open) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <CrashReportDialogSurface
        open={open}
        report={report}
        loading={loading}
        onOpenChange={setOpen}
        onReportChange={setReport}
      />
    </Suspense>
  )
}
