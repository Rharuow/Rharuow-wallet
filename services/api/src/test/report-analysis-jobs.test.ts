import assert from 'node:assert/strict'
import {
  AssetReportAssetType,
  ReportAnalysisJobStatus,
  ReportAnalysisRequestMode,
} from '@prisma/client'
import { after, beforeEach, test } from 'node:test'
import { prisma } from '../lib/prisma'
import {
  cleanupTestData,
  createTestUser,
} from './testUtils'
import {
  createReportAnalysisJob,
  findActiveReportSearchCooldown,
  listReportAnalysisJobs,
  updateReportAnalysisJobStatus,
  upsertReportSearchCooldown,
} from '../modules/reports/report-jobs.service'

beforeEach(async () => {
  await cleanupTestData()
})

after(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
  setImmediate(() => process.exit(process.exitCode ?? 0))
})

test('report-analysis-jobs.spec: cria job e atualiza status de processamento', async () => {
  const user = await createTestUser({ name: 'Report Job User' })

  const job = await createReportAnalysisJob({
    userId: user.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'petr4',
    requestMode: ReportAnalysisRequestMode.AUTO_WEB,
    metadata: { origin: 'test' },
  })

  assert.equal(job.status, ReportAnalysisJobStatus.QUEUED)
  assert.equal(job.ticker, 'PETR4')

  const running = await updateReportAnalysisJobStatus({
    jobId: job.id,
    status: ReportAnalysisJobStatus.SEARCHING_REPORT,
  })

  assert.equal(running.status, ReportAnalysisJobStatus.SEARCHING_REPORT)
  assert.equal(running.attemptCount, 1)
  assert.ok(running.startedAt)
  assert.equal(running.finishedAt, null)

  const finished = await updateReportAnalysisJobStatus({
    jobId: job.id,
    status: ReportAnalysisJobStatus.FAILED,
    failureCode: 'REPORT_SOURCE_NOT_FOUND',
    failureMessage: 'No source found',
  })

  assert.equal(finished.status, ReportAnalysisJobStatus.FAILED)
  assert.equal(finished.attemptCount, 2)
  assert.equal(finished.failureCode, 'REPORT_SOURCE_NOT_FOUND')
  assert.ok(finished.finishedAt)

  const jobs = await listReportAnalysisJobs(user.id)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0]?.id, job.id)
})

test('report-analysis-jobs.spec: cria e reaproveita cooldown ativo por ticker', async () => {
  const user = await createTestUser({ name: 'Cooldown User' })

  const job = await createReportAnalysisJob({
    userId: user.id,
    assetType: AssetReportAssetType.FII,
    ticker: 'mxrf11',
    requestMode: ReportAnalysisRequestMode.AUTO_WEB,
  })

  const blockedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const cooldown = await upsertReportSearchCooldown({
    assetType: AssetReportAssetType.FII,
    ticker: 'mxrf11',
    reasonCode: 'REPORT_SOURCE_NOT_FOUND',
    blockedUntil,
    lastJobId: job.id,
    metadata: { attempts: 1 },
  })

  assert.equal(cooldown.ticker, 'MXRF11')
  assert.equal(cooldown.lastJobId, job.id)

  const active = await findActiveReportSearchCooldown({
    assetType: AssetReportAssetType.FII,
    ticker: 'MXRF11',
  })

  assert.ok(active)
  assert.equal(active?.id, cooldown.id)
  assert.equal(active?.lastJobId, job.id)

  const updated = await upsertReportSearchCooldown({
    assetType: AssetReportAssetType.FII,
    ticker: 'MXRF11',
    reasonCode: 'SEARCH_DISABLED_BY_POLICY',
    blockedUntil: new Date(blockedUntil.getTime() + 24 * 60 * 60 * 1000),
    lastJobId: job.id,
  })

  assert.equal(updated.id, cooldown.id)
  assert.equal(updated.reasonCode, 'SEARCH_DISABLED_BY_POLICY')
})