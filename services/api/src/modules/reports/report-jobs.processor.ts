import {
  AssetReportAssetType,
  ReportAnalysisJobStatus,
  ReportAnalysisRequestMode,
} from '@prisma/client'
import {
  createManualReportAnalysis,
  createOnDemandReportAnalysis,
} from './reports.service'
import {
  getReportAnalysisJobById,
  updateReportAnalysisJobStatus,
  upsertReportSearchCooldown,
} from './report-jobs.service'

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

export async function processReportAnalysisRequestedJob(payload: {
  jobId: string
  userId: string
  assetType: AssetReportAssetType
  ticker: string
  requestMode: ReportAnalysisRequestMode
}) {
  console.info('[report-jobs.processor] start', {
    jobId: payload.jobId,
    userId: payload.userId,
    ticker: payload.ticker,
    assetType: payload.assetType,
    requestMode: payload.requestMode,
  })

  const job = await getReportAnalysisJobById(payload.jobId)
  if (!job) {
    console.warn('[report-jobs.processor] skip-job-not-found', { jobId: payload.jobId })
    return
  }

  if (job.status !== ReportAnalysisJobStatus.QUEUED) {
    console.warn('[report-jobs.processor] skip-job-not-queued', {
      jobId: payload.jobId,
      currentStatus: job.status,
    })
    return
  }

  if (payload.requestMode === ReportAnalysisRequestMode.AUTO_WEB) {
    console.info('[report-jobs.processor] transition', {
      jobId: job.id,
      from: job.status,
      to: ReportAnalysisJobStatus.SEARCHING_REPORT,
    })
    await updateReportAnalysisJobStatus({
      jobId: job.id,
      status: ReportAnalysisJobStatus.SEARCHING_REPORT,
    })

    try {
      const result = await createOnDemandReportAnalysis({
        userId: payload.userId,
        assetType: payload.assetType,
        ticker: payload.ticker,
      })

      await updateReportAnalysisJobStatus({
        jobId: job.id,
        status: ReportAnalysisJobStatus.COMPLETED,
        analysisId: result.analysis.id,
        sourceId: result.analysis.source.id,
        priceCharged: result.chargedAmount,
      })
      console.info('[report-jobs.processor] transition', {
        jobId: job.id,
        to: ReportAnalysisJobStatus.COMPLETED,
        analysisId: result.analysis.id,
      })
      return
    } catch (error) {
      const err = error as Error & { statusCode?: number }

      if (err.message === 'REPORT_SOURCE_NOT_FOUND') {
        await upsertReportSearchCooldown({
          assetType: payload.assetType,
          ticker: payload.ticker,
          reasonCode: err.message,
          blockedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          lastJobId: job.id,
          metadata: {
            statusCode: err.statusCode ?? null,
          },
        })

        await updateReportAnalysisJobStatus({
          jobId: job.id,
          status: ReportAnalysisJobStatus.SEARCH_UNAVAILABLE,
          failureCode: err.message,
          failureMessage: 'Fonte indisponivel para busca automatica.',
        })
        console.warn('[report-jobs.processor] transition', {
          jobId: job.id,
          to: ReportAnalysisJobStatus.SEARCH_UNAVAILABLE,
          failureCode: err.message,
        })
        return
      }

      await updateReportAnalysisJobStatus({
        jobId: job.id,
        status: ReportAnalysisJobStatus.FAILED,
        failureCode: err.message,
        failureMessage: err.message,
      })
      console.error('[report-jobs.processor] transition', {
        jobId: job.id,
        to: ReportAnalysisJobStatus.FAILED,
        failureCode: err.message,
      })
      return
    }
  }

  const metadata = isObject(job.metadata) ? job.metadata : {}
  const originalFileName = typeof metadata.originalFileName === 'string' ? metadata.originalFileName : null
  const contentType = typeof metadata.contentType === 'string' ? metadata.contentType : undefined
  const storageKey = typeof metadata.storageKey === 'string' ? metadata.storageKey : null

  console.info('[report-jobs.processor] transition', {
    jobId: job.id,
    from: job.status,
    to: ReportAnalysisJobStatus.VALIDATING_REPORT,
  })
  await updateReportAnalysisJobStatus({
    jobId: job.id,
    status: ReportAnalysisJobStatus.VALIDATING_REPORT,
  })

  if (!originalFileName || !storageKey) {
    await updateReportAnalysisJobStatus({
      jobId: job.id,
      status: ReportAnalysisJobStatus.FAILED,
      failureCode: 'MANUAL_REPORT_METADATA_MISSING',
      failureMessage: 'Metadados insuficientes para processar upload manual.',
    })
    console.error('[report-jobs.processor] transition', {
      jobId: job.id,
      to: ReportAnalysisJobStatus.FAILED,
      failureCode: 'MANUAL_REPORT_METADATA_MISSING',
    })
    return
  }

  console.info('[report-jobs.processor] transition', {
    jobId: job.id,
    to: ReportAnalysisJobStatus.ANALYZING_REPORT,
  })
  await updateReportAnalysisJobStatus({
    jobId: job.id,
    status: ReportAnalysisJobStatus.ANALYZING_REPORT,
  })

  try {
    const result = await createManualReportAnalysis({
      userId: payload.userId,
      assetType: payload.assetType,
      ticker: payload.ticker,
      originalFileName,
      contentType,
      storageKey,
    })

    await updateReportAnalysisJobStatus({
      jobId: job.id,
      status: ReportAnalysisJobStatus.COMPLETED,
      analysisId: result.analysis.id,
      sourceId: result.analysis.source.id,
      priceCharged: result.chargedAmount,
    })
    console.info('[report-jobs.processor] transition', {
      jobId: job.id,
      to: ReportAnalysisJobStatus.COMPLETED,
      analysisId: result.analysis.id,
    })
  } catch (error) {
    const err = error as Error
    await updateReportAnalysisJobStatus({
      jobId: job.id,
      status: ReportAnalysisJobStatus.FAILED,
      failureCode: err.message,
      failureMessage: err.message,
    })
    console.error('[report-jobs.processor] transition', {
      jobId: job.id,
      to: ReportAnalysisJobStatus.FAILED,
      failureCode: err.message,
    })
  }
}
