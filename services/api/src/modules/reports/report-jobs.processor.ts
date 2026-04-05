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
  const job = await getReportAnalysisJobById(payload.jobId)
  if (!job) {
    return
  }

  if (job.status !== ReportAnalysisJobStatus.QUEUED) {
    return
  }

  if (payload.requestMode === ReportAnalysisRequestMode.AUTO_WEB) {
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
        return
      }

      await updateReportAnalysisJobStatus({
        jobId: job.id,
        status: ReportAnalysisJobStatus.FAILED,
        failureCode: err.message,
        failureMessage: err.message,
      })
      return
    }
  }

  const metadata = isObject(job.metadata) ? job.metadata : {}
  const originalFileName = typeof metadata.originalFileName === 'string' ? metadata.originalFileName : null
  const contentType = typeof metadata.contentType === 'string' ? metadata.contentType : undefined
  const storageKey = typeof metadata.storageKey === 'string' ? metadata.storageKey : null

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
    return
  }

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
  } catch (error) {
    const err = error as Error
    await updateReportAnalysisJobStatus({
      jobId: job.id,
      status: ReportAnalysisJobStatus.FAILED,
      failureCode: err.message,
      failureMessage: err.message,
    })
  }
}
