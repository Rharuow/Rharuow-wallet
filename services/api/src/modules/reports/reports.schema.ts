import { z } from 'zod'
import { AssetReportAssetType } from '@prisma/client'

export const createReportAnalysisSchema = z.object({
  assetType: z.nativeEnum(AssetReportAssetType),
  ticker: z.string().trim().min(4).max(12),
})

export const createManualReportAnalysisSchema = z.object({
  assetType: z.nativeEnum(AssetReportAssetType),
  ticker: z.string().trim().min(4).max(12),
  originalFileName: z.string().trim().min(1).max(160),
  contentType: z.string().trim().min(1).max(120).optional(),
  fileBase64: z.string().trim().min(1).max(10_000_000),
})

export const reportAnalysisParamsSchema = z.object({
  id: z.string().min(1),
})