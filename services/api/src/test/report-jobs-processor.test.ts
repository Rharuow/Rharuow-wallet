import assert from 'node:assert/strict'
import {
  AssetReportAssetType,
  PlanType,
  ReportAnalysisJobStatus,
  ReportAnalysisRequestMode,
} from '@prisma/client'
import { after, beforeEach, test } from 'node:test'
import { prisma } from '../lib/prisma'
import {
  createCreditTopupOrder,
  getCreditBalance,
  markCreditTopupOrderPaid,
} from '../modules/credits/credits.service'
import { processReportAnalysisRequestedJob } from '../modules/reports/report-jobs.processor'
import {
  createReportAnalysisJob,
  getReportAnalysisJobById,
} from '../modules/reports/report-jobs.service'
import { storeManualUploadObject } from '../modules/reports/reports.service'
import {
  cleanupTestData,
  createTestUser,
  updateUserPlan,
} from './testUtils'

process.env.NODE_ENV = 'test'
process.env.REPORT_JOBS_DISABLE_KAFKA = 'true'

beforeEach(async () => {
  await cleanupTestData()
})

after(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
  setImmediate(() => process.exit(process.exitCode ?? 0))
})

async function seedCredits(userId: string, amount: number, suffix: string) {
  const order = await createCreditTopupOrder({
    userId,
    amount,
    stripeCheckoutSessionId: `cs_test_report_processor_${suffix}`,
  })

  await markCreditTopupOrderPaid({
    orderId: order.id,
    stripePaymentIntentId: `pi_test_report_processor_${suffix}`,
  })
}

test('report-jobs-processor.spec: processa job manual lendo arquivo via storageKey', async () => {
  const user = await createTestUser({ name: 'Manual Worker User', plan: PlanType.FREE })
  await seedCredits(user.id, 6, 'manual-storage')

  const manualText = [
    'Relatorio manual do ativo ABCD4 com receita crescente, margem operacional estavel, endividamento controlado e riscos setoriais bem delimitados.',
    'O documento detalha guidance, sensibilidade de margem e principais catalisadores para os proximos trimestres.',
  ].join(' ')

  const storedUpload = await storeManualUploadObject({
    assetType: AssetReportAssetType.STOCK,
    ticker: 'ABCD4',
    originalFileName: 'abcd4-relatorio.txt',
    contentType: 'text/plain',
    fileBase64: Buffer.from(manualText, 'utf8').toString('base64'),
  })

  const job = await createReportAnalysisJob({
    userId: user.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'ABCD4',
    requestMode: ReportAnalysisRequestMode.MANUAL_UPLOAD,
    metadata: {
      originalFileName: 'abcd4-relatorio.txt',
      contentType: 'text/plain',
      storageKey: storedUpload.storageKey,
      fileSizeBytes: storedUpload.fileSizeBytes,
    },
  })

  await processReportAnalysisRequestedJob({
    jobId: job.id,
    userId: user.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'ABCD4',
    requestMode: ReportAnalysisRequestMode.MANUAL_UPLOAD,
  })

  const processedJob = await getReportAnalysisJobById(job.id)
  assert.ok(processedJob)
  assert.equal(processedJob?.status, ReportAnalysisJobStatus.COMPLETED)
  assert.ok(processedJob?.analysis)
  assert.equal(processedJob?.analysis?.source.storageKey, storedUpload.storageKey)
})

test('report-jobs-processor.spec: falha job manual sem storageKey valido', async () => {
  const user = await createTestUser({ name: 'Manual Worker Invalid', plan: PlanType.FREE })
  await updateUserPlan(user.id, PlanType.PREMIUM)
  await seedCredits(user.id, 6, 'manual-invalid')

  const job = await createReportAnalysisJob({
    userId: user.id,
    assetType: AssetReportAssetType.FII,
    ticker: 'MXRF11',
    requestMode: ReportAnalysisRequestMode.MANUAL_UPLOAD,
    metadata: {
      originalFileName: 'mxrf11-relatorio.txt',
      contentType: 'text/plain',
    },
  })

  await processReportAnalysisRequestedJob({
    jobId: job.id,
    userId: user.id,
    assetType: AssetReportAssetType.FII,
    ticker: 'MXRF11',
    requestMode: ReportAnalysisRequestMode.MANUAL_UPLOAD,
  })

  const processedJob = await getReportAnalysisJobById(job.id)
  assert.ok(processedJob)
  assert.equal(processedJob?.status, ReportAnalysisJobStatus.FAILED)
  assert.equal(processedJob?.failureCode, 'MANUAL_REPORT_METADATA_MISSING')
})

test('report-jobs-processor.spec: falha job manual quando documento nao pertence ao ticker', async () => {
  const user = await createTestUser({ name: 'Manual Worker Mismatch', plan: PlanType.FREE })
  await seedCredits(user.id, 6, 'manual-mismatch')

  const storedUpload = await storeManualUploadObject({
    assetType: AssetReportAssetType.STOCK,
    ticker: 'PETR4',
    originalFileName: 'vale3-relatorio.txt',
    contentType: 'text/plain',
    fileBase64: Buffer.from(
      'Relatorio da companhia VALE3 com foco em mineracao, exportacao, custo caixa e dinamica do minerio de ferro no mercado internacional.',
      'utf8',
    ).toString('base64'),
  })

  const job = await createReportAnalysisJob({
    userId: user.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'PETR4',
    requestMode: ReportAnalysisRequestMode.MANUAL_UPLOAD,
    metadata: {
      originalFileName: 'vale3-relatorio.txt',
      contentType: 'text/plain',
      storageKey: storedUpload.storageKey,
      fileSizeBytes: storedUpload.fileSizeBytes,
    },
  })

  await processReportAnalysisRequestedJob({
    jobId: job.id,
    userId: user.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'PETR4',
    requestMode: ReportAnalysisRequestMode.MANUAL_UPLOAD,
  })

  const processedJob = await getReportAnalysisJobById(job.id)
  assert.ok(processedJob)
  assert.equal(processedJob?.status, ReportAnalysisJobStatus.FAILED)
  assert.equal(processedJob?.failureCode, 'REPORT_SOURCE_MANUAL_ASSET_MISMATCH')

  const balance = await getCreditBalance(user.id)
  assert.equal(balance.balance.toString(), '6')
})
