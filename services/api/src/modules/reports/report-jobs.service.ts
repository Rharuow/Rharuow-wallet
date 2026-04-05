import {
  AssetReportAssetType,
  Prisma,
  ReportAnalysisJobStatus,
  ReportAnalysisRequestMode,
  ReportSearchCooldownSource,
} from '@prisma/client'
import { prisma } from '../../lib/prisma'

type JsonValue = Prisma.InputJsonValue

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase()
}

export async function createReportAnalysisJob(input: {
  userId: string
  assetType: AssetReportAssetType
  ticker: string
  requestMode: ReportAnalysisRequestMode
  metadata?: JsonValue
}) {
  return prisma.reportAnalysisJob.create({
    data: {
      userId: input.userId,
      assetType: input.assetType,
      ticker: normalizeTicker(input.ticker),
      requestMode: input.requestMode,
      metadata: input.metadata,
    },
  })
}

export async function updateReportAnalysisJobStatus(input: {
  jobId: string
  status: ReportAnalysisJobStatus
  failureCode?: string | null
  failureMessage?: string | null
  analysisId?: string | null
  sourceId?: string | null
  priceCharged?: Prisma.Decimal | number | string | null
}) {
  const now = new Date()

  return prisma.reportAnalysisJob.update({
    where: { id: input.jobId },
    data: {
      status: input.status,
      failureCode: input.failureCode,
      failureMessage: input.failureMessage,
      analysisId: input.analysisId,
      sourceId: input.sourceId,
      priceCharged:
        input.priceCharged == null ? input.priceCharged : new Prisma.Decimal(input.priceCharged),
      startedAt:
        input.status === ReportAnalysisJobStatus.QUEUED ? undefined : now,
      finishedAt:
        input.status === ReportAnalysisJobStatus.COMPLETED ||
        input.status === ReportAnalysisJobStatus.SEARCH_UNAVAILABLE ||
        input.status === ReportAnalysisJobStatus.FAILED
          ? now
          : null,
      attemptCount: { increment: 1 },
    },
    include: {
      analysis: true,
      source: true,
    },
  })
}

export async function listReportAnalysisJobs(userId: string) {
  return prisma.reportAnalysisJob.findMany({
    where: { userId },
    include: {
      analysis: {
        include: {
          source: true,
        },
      },
      source: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export async function getReportAnalysisJobById(jobId: string) {
  return prisma.reportAnalysisJob.findUnique({
    where: { id: jobId },
    include: {
      analysis: {
        include: {
          source: true,
        },
      },
      source: true,
    },
  })
}

export async function upsertReportSearchCooldown(input: {
  assetType: AssetReportAssetType
  ticker: string
  source?: ReportSearchCooldownSource
  reasonCode: string
  blockedUntil: Date
  lastJobId?: string | null
  metadata?: JsonValue
}) {
  const ticker = normalizeTicker(input.ticker)
  const source = input.source ?? ReportSearchCooldownSource.AUTO_WEB

  return prisma.reportSearchCooldown.upsert({
    where: {
      assetType_ticker_source: {
        assetType: input.assetType,
        ticker,
        source,
      },
    },
    update: {
      reasonCode: input.reasonCode,
      blockedUntil: input.blockedUntil,
      lastJobId: input.lastJobId,
      metadata: input.metadata,
    },
    create: {
      assetType: input.assetType,
      ticker,
      source,
      reasonCode: input.reasonCode,
      blockedUntil: input.blockedUntil,
      lastJobId: input.lastJobId,
      metadata: input.metadata,
    },
  })
}

export async function findActiveReportSearchCooldown(input: {
  assetType: AssetReportAssetType
  ticker: string
  source?: ReportSearchCooldownSource
  now?: Date
}) {
  const ticker = normalizeTicker(input.ticker)
  const source = input.source ?? ReportSearchCooldownSource.AUTO_WEB
  const now = input.now ?? new Date()

  return prisma.reportSearchCooldown.findFirst({
    where: {
      assetType: input.assetType,
      ticker,
      source,
      blockedUntil: { gt: now },
    },
    include: {
      lastJob: true,
    },
  })
}