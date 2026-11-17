import type { TelemetryConsentState } from '../../shared/telemetry-consent-types'
import type { StatsSummary } from '../../shared/process-stats-types'

export type StatsApi = {
  getSummary: () => Promise<StatsSummary>
}

// Diagnostics IPC payloads; mirror the runtime types in `src/main/observability/{index,bundle}.ts`.
export type DiagnosticsStatusPayload = {
  readonly localFileEnabled: boolean
  readonly bundleEnabled: boolean
  readonly traceFilePath: string
  readonly traceFamilySize: number
  readonly disabledReason?:
    | 'do_not_track'
    | 'orca_telemetry_disabled'
    | 'orca_diagnostics_disabled'
    | 'ci'
}
export type DiagnosticsBundlePayload = {
  readonly bundleSubmissionId: string
  readonly bytes: number
  readonly spanCount: number
}
export type DiagnosticsUploadPayload =
  | {
      readonly ticketId: string
    }
  | {
      readonly canceled: true
    }

// RA: no renderer memory API; CLI diagnostics retain their own RPC.
export type DiagnosticsApi = {
  getStatus: () => Promise<DiagnosticsStatusPayload>
  collectBundle: (lookbackMinutes?: number) => Promise<DiagnosticsBundlePayload>
  openBundlePreview: (bundleSubmissionId: string) => Promise<void>
  discardBundlePreview: (bundleSubmissionId: string) => Promise<void>
  uploadBundle: (bundleSubmissionId: string) => Promise<DiagnosticsUploadPayload>
  deleteBundle: (ticketId: string) => Promise<void>
}

export type TelemetryApi = {
  /** Use lib/telemetry.ts; true means captured/already recorded today, void is a legacy reply. */
  telemetryTrack: (name: string, props: Record<string, unknown>) => Promise<boolean | void>
  /** Main permits at most five consent mutations per session. */
  telemetrySetOptIn: (optedIn: boolean) => Promise<void>
  /** Main retains upload payloads so the renderer cannot read or substitute arbitrary bytes. */
  diagnostics: DiagnosticsApi
  telemetryGetConsentState: () => Promise<TelemetryConsentState>
  /** Banner dismissal opts in without emitting telemetry_opted_in; shares the consent rate limit. */
  telemetryAcknowledgeBanner: () => Promise<void>
  stats: StatsApi
}
