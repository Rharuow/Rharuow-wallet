import assert from 'node:assert/strict'
import { AssetReportAssetType, AssetReportSourceKind } from '@prisma/client'
import { after, beforeEach, test } from 'node:test'
import { prisma } from '../lib/prisma'
import {
  cleanupTestData,
  createTestUser,
} from './testUtils'
import {
  findActiveAssetReportAccess,
  findReusableAssetReportAnalysis,
  grantAssetReportAccess,
  upsertAssetReportAnalysis,
  upsertAssetReportSource,
} from '../modules/reports/report-analysis.service'

beforeEach(async () => {
  await cleanupTestData()
})

after(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
  setImmediate(() => process.exit(process.exitCode ?? 0))
})

test('report-analysis-access.spec: reaproveita analise valida pelo fingerprint do documento', async () => {
  const source = await upsertAssetReportSource({
    assetType: AssetReportAssetType.FII,
    ticker: 'mxrf11',
    sourceKind: AssetReportSourceKind.AUTO_FOUND,
    sourceUrl: 'https://example.com/mxrf11-report.pdf',
    documentFingerprint: 'mxrf11-fp-v1',
  })

  const analysis = await upsertAssetReportAnalysis({
    assetType: AssetReportAssetType.FII,
    ticker: 'mxrf11',
    sourceId: source.id,
    analysisText: 'Analise do relatorio MXRF11',
    model: 'gpt-4o-mini',
    validUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  })

  const reusable = await findReusableAssetReportAnalysis({
    assetType: AssetReportAssetType.FII,
    ticker: 'MXRF11',
    documentFingerprint: 'mxrf11-fp-v1',
  })

  assert.ok(reusable)
  assert.equal(reusable?.id, analysis.id)
  assert.equal(reusable?.source.documentFingerprint, 'mxrf11-fp-v1')
})

test('report-analysis-access.spec: ignora analise expirada e concede acesso por 30 dias', async () => {
  const user = await createTestUser({ name: 'Report Access User' })

  const expiredSource = await upsertAssetReportSource({
    assetType: AssetReportAssetType.STOCK,
    ticker: 'petr4',
    sourceKind: AssetReportSourceKind.MANUAL_UPLOAD,
    originalFileName: 'petr4-report.pdf',
    documentFingerprint: 'petr4-fp-old',
  })

  await upsertAssetReportAnalysis({
    assetType: AssetReportAssetType.STOCK,
    ticker: 'petr4',
    sourceId: expiredSource.id,
    analysisText: 'Analise antiga',
    model: 'gpt-4o-mini',
    validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
  })

  const expiredReusable = await findReusableAssetReportAnalysis({
    assetType: AssetReportAssetType.STOCK,
    ticker: 'PETR4',
  })

  assert.equal(expiredReusable, null)

  const activeSource = await upsertAssetReportSource({
    assetType: AssetReportAssetType.STOCK,
    ticker: 'petr4',
    sourceKind: AssetReportSourceKind.AUTO_FOUND,
    sourceUrl: 'https://example.com/petr4-report-new.pdf',
    documentFingerprint: 'petr4-fp-new',
  })

  const activeAnalysis = await upsertAssetReportAnalysis({
    assetType: AssetReportAssetType.STOCK,
    ticker: 'petr4',
    sourceId: activeSource.id,
    analysisText: 'Analise valida',
    model: 'gpt-4o-mini',
    validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  })

  const access = await grantAssetReportAccess({
    userId: user.id,
    analysisId: activeAnalysis.id,
  })

  const activeAccess = await findActiveAssetReportAccess({
    userId: user.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'PETR4',
  })

  assert.ok(activeAccess)
  assert.equal(activeAccess?.id, access.id)
  assert.equal(activeAccess?.analysis.id, activeAnalysis.id)

  const expectedMinTtl = Date.now() + 29 * 24 * 60 * 60 * 1000
  assert.ok(activeAccess!.expiresAt.getTime() >= expectedMinTtl)
})