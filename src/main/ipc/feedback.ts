// RA: keep old renderer/crash callers compatible without any upload client, OS profiling, or outside service.
import { ipcMain } from 'electron'
import type {
  FeedbackSubmitArgs,
  FeedbackSubmitResult
} from '../../shared/feedback-submit-contract'
export type {
  FeedbackImageAttachment,
  FeedbackRequestFailure,
  FeedbackSubmitArgs,
  FeedbackSubmitResult
} from '../../shared/feedback-submit-contract'
export type FeedbackSubmissionType = 'feedback' | 'crash'
export type FeedbackDiagnosticBundleAttachment = {
  bundleSubmissionId: string
  content: string
  bytes: number
  spanCount: number
}

type InternalFeedbackSubmitArgs = FeedbackSubmitArgs & {
  submissionType?: FeedbackSubmissionType
  diagnosticBundle?: FeedbackDiagnosticBundleAttachment
  feedbackWithoutDiagnosticBundle?: string
}

export async function submitFeedback(
  _args: InternalFeedbackSubmitArgs
): Promise<FeedbackSubmitResult> {
  return { ok: false, status: null, error: 'Feedback uploads are disabled in local-only Orca' }
}

export function registerFeedbackHandlers(): void {
  ipcMain.removeHandler('feedback:submit')
  ipcMain.handle('feedback:submit', (_event, args: FeedbackSubmitArgs) => submitFeedback(args))
}
