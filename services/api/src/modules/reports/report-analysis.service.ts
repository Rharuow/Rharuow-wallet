import {
  AssetReportAssetType,
  AssetReportSourceKind,
  Prisma,
  ReportMode,
} from '@prisma/client'
import { prisma } from '../../lib/prisma'

type JsonValue = Prisma.InputJsonValue

const ACCESS_TTL_DAYS = 30

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase()
}

export async function upsertAssetReportSource(input: {
  assetType: AssetReportAssetType
  ticker: string
  reportMode: ReportMode
  monthKey: string
  sourceKind: AssetReportSourceKind
  documentFingerprint: string
  sourceUrl?: string | null
  storageKey?: string | null
  originalFileName?: string | null
  metadata?: JsonValue
}) {
  const ticker = normalizeTicker(input.ticker)

  return prisma.assetReportSource.upsert({
    where: {
      assetType_ticker_documentFingerprint: {
        assetType: input.assetType,
        ticker,
        documentFingerprint: input.documentFingerprint,
      },
    },
    update: {
      reportMode: input.reportMode,
      monthKey: input.monthKey,
      sourceKind: input.sourceKind,
      sourceUrl: input.sourceUrl,
      storageKey: input.storageKey,
      originalFileName: input.originalFileName,
      metadata: input.metadata,
    },
    create: {
      assetType: input.assetType,
      ticker,
      reportMode: input.reportMode,
      monthKey: input.monthKey,
      sourceKind: input.sourceKind,
      sourceUrl: input.sourceUrl,
      storageKey: input.storageKey,
      originalFileName: input.originalFileName,
      documentFingerprint: input.documentFingerprint,
      metadata: input.metadata,
    },
  })
}

export async function upsertAssetReportAnalysis(input: {
  assetType: AssetReportAssetType
  ticker: string
  reportMode: ReportMode
  monthKey: string
  sourceId: string
  analysisText: string
  model: string
  validUntil: Date
  metadata?: JsonValue
}) {
  const ticker = normalizeTicker(input.ticker)

  return prisma.assetReportAnalysis.upsert({
    where: {
      assetType_ticker_sourceId: {
        assetType: input.assetType,
        ticker,
        sourceId: input.sourceId,
      },
    },
    update: {
      reportMode: input.reportMode,
      monthKey: input.monthKey,
      analysisText: input.analysisText,
      model: input.model,
      validUntil: input.validUntil,
      metadata: input.metadata,
    },
    create: {
      assetType: input.assetType,
      ticker,
      reportMode: input.reportMode,
      monthKey: input.monthKey,
      sourceId: input.sourceId,
      analysisText: input.analysisText,
      model: input.model,
      validUntil: input.validUntil,
      metadata: input.metadata,
    },
    include: {
      source: true,
    },
  })
}

export async function findReusableAssetReportAnalysis(input: {
  assetType: AssetReportAssetType
  ticker: string
  reportMode: ReportMode
  monthKey: string
  now?: Date
}) {
  const ticker = normalizeTicker(input.ticker)
  const now = input.now ?? new Date()

  return prisma.assetReportAnalysis.findFirst({
    where: {
      assetType: input.assetType,
      ticker,
      reportMode: input.reportMode,
      monthKey: input.monthKey,
      validUntil: { gt: now },
    },
    include: {
      source: true,
    },
    orderBy: [
      { validUntil: 'desc' },
      { createdAt: 'desc' },
    ],
  })
}

export async function grantAssetReportAccess(input: {
  userId: string
  analysisId: string
  accessTtlDays?: number
}) {
  const ttlDays = input.accessTtlDays ?? ACCESS_TTL_DAYS
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)

  return prisma.userAssetReportAccess.upsert({
    where: {
      userId_analysisId: {
        userId: input.userId,
        analysisId: input.analysisId,
      },
    },
    update: {
      expiresAt,
    },
    create: {
      userId: input.userId,
      analysisId: input.analysisId,
      expiresAt,
    },
    include: {
      analysis: {
        include: {
          source: true,
        },
      },
    },
  })
}

export async function findActiveAssetReportAccess(input: {
  userId: string
  assetType: AssetReportAssetType
  ticker: string
  reportMode: ReportMode
  monthKey: string
  now?: Date
}) {
  const ticker = normalizeTicker(input.ticker)
  const now = input.now ?? new Date()

  return prisma.userAssetReportAccess.findFirst({
    where: {
      userId: input.userId,
      expiresAt: { gt: now },
      analysis: {
        assetType: input.assetType,
        ticker,
        reportMode: input.reportMode,
        monthKey: input.monthKey,
      },
    },
    include: {
      analysis: {
        include: {
          source: true,
        },
      },
    },
    orderBy: {
      expiresAt: 'desc',
    },
  })
}