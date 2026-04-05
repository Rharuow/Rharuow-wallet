import assert from 'node:assert/strict'
import { AssetReportAssetType } from '@prisma/client'
import { after, beforeEach, test } from 'node:test'
import type { FastifyInstance } from 'fastify'
import {
  authHeaders,
  cleanupTestData,
  createTestServer,
  createTestUser,
  finalizeTestProcess,
  parseJson,
} from './testUtils'
import {
  createReportAnalysisJob,
  listReportAnalysisJobs,
  upsertReportSearchCooldown,
} from '../modules/reports/report-jobs.service'

process.env.NODE_ENV = 'test'

type RequestMode = 'AUTO_WEB' | 'MANUAL_UPLOAD'

let server: FastifyInstance

beforeEach(async () => {
  await cleanupTestData()
  server = await createTestServer()
})

after(async () => {
  await finalizeTestProcess(server)
})

test('report-jobs-routes.spec: cria job automatico e lista somente jobs do usuario autenticado', async () => {
  const owner = await createTestUser({ name: 'Jobs Owner' })
  const other = await createTestUser({ name: 'Jobs Other' })

  const createResponse = await server.inject({
    method: 'POST',
    url: '/v1/reports/jobs',
    headers: authHeaders(server, owner),
    payload: {
      assetType: AssetReportAssetType.STOCK,
      ticker: 'petr4',
    },
  })

  assert.equal(createResponse.statusCode, 202)

  const createdPayload = parseJson<{
    job: {
      id: string
      userId: string
      assetType: AssetReportAssetType
      ticker: string
      requestMode: RequestMode
      status: string
    }
  }>(createResponse)

  assert.equal(createdPayload.job.userId, owner.id)
  assert.equal(createdPayload.job.assetType, AssetReportAssetType.STOCK)
  assert.equal(createdPayload.job.ticker, 'PETR4')
  assert.equal(createdPayload.job.requestMode, 'AUTO_WEB')
  assert.equal(createdPayload.job.status, 'QUEUED')

  await createReportAnalysisJob({
    userId: other.id,
    assetType: AssetReportAssetType.FII,
    ticker: 'mxrf11',
    requestMode: 'AUTO_WEB',
  })

  const listResponse = await server.inject({
    method: 'GET',
    url: '/v1/reports/jobs',
    headers: authHeaders(server, owner),
  })

  assert.equal(listResponse.statusCode, 200)
  const listPayload = parseJson<{
    jobs: Array<{ id: string; userId: string }>
  }>(listResponse)

  assert.equal(listPayload.jobs.length, 1)
  assert.equal(listPayload.jobs[0]?.id, createdPayload.job.id)
  assert.equal(listPayload.jobs[0]?.userId, owner.id)
})

test('report-jobs-routes.spec: consulta job por id com isolamento entre usuarios e cria job manual', async () => {
  const owner = await createTestUser({ name: 'Job Owner' })
  const other = await createTestUser({ name: 'Job Viewer' })

  const manualBodyText = 'Relatorio manual do ativo ABCD4 com dados de receita, margem, endividamento e riscos setoriais para validacao no fluxo assincrono.'

  const createManualResponse = await server.inject({
    method: 'POST',
    url: '/v1/reports/jobs/manual',
    headers: authHeaders(server, owner),
    payload: {
      assetType: AssetReportAssetType.STOCK,
      ticker: 'abcd4',
      originalFileName: 'abcd4-relatorio.txt',
      contentType: 'text/plain',
      fileBase64: Buffer.from(manualBodyText, 'utf8').toString('base64'),
    },
  })

  assert.equal(createManualResponse.statusCode, 202)

  const createManualPayload = parseJson<{
    job: {
      id: string
      userId: string
      requestMode: RequestMode
      metadata: {
        originalFileName: string
        contentType: string | null
        storageKey: string
        fileSizeBytes: number
      }
    }
  }>(createManualResponse)

  assert.equal(createManualPayload.job.userId, owner.id)
  assert.equal(createManualPayload.job.requestMode, 'MANUAL_UPLOAD')
  assert.equal(createManualPayload.job.metadata.originalFileName, 'abcd4-relatorio.txt')
  assert.equal(createManualPayload.job.metadata.contentType, 'text/plain')
  assert.ok(createManualPayload.job.metadata.storageKey)
  assert.ok(createManualPayload.job.metadata.fileSizeBytes > 0)

  const ownerGetResponse = await server.inject({
    method: 'GET',
    url: `/v1/reports/jobs/${createManualPayload.job.id}`,
    headers: authHeaders(server, owner),
  })

  assert.equal(ownerGetResponse.statusCode, 200)

  const otherGetResponse = await server.inject({
    method: 'GET',
    url: `/v1/reports/jobs/${createManualPayload.job.id}`,
    headers: authHeaders(server, other),
  })

  assert.equal(otherGetResponse.statusCode, 404)
  const otherPayload = parseJson<{ error: string }>(otherGetResponse)
  assert.equal(otherPayload.error, 'REPORT_ANALYSIS_JOB_NOT_FOUND')
})

test('report-jobs-routes.spec: bloqueia criacao automatica quando cooldown estiver ativo', async () => {
  const user = await createTestUser({ name: 'Cooldown Route User' })

  const seededJob = await createReportAnalysisJob({
    userId: user.id,
    assetType: AssetReportAssetType.FII,
    ticker: 'xplg11',
    requestMode: 'AUTO_WEB',
  })

  await upsertReportSearchCooldown({
    assetType: AssetReportAssetType.FII,
    ticker: 'xplg11',
    reasonCode: 'REPORT_SOURCE_NOT_FOUND',
    blockedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    lastJobId: seededJob.id,
  })

  const response = await server.inject({
    method: 'POST',
    url: '/v1/reports/jobs',
    headers: authHeaders(server, user),
    payload: {
      assetType: AssetReportAssetType.FII,
      ticker: 'XPLG11',
    },
  })

  assert.equal(response.statusCode, 409)
  const payload = parseJson<{ error: string; reasonCode: string; blockedUntil: string }>(response)
  assert.equal(payload.error, 'REPORT_AUTO_SEARCH_COOLDOWN_ACTIVE')
  assert.equal(payload.reasonCode, 'REPORT_SOURCE_NOT_FOUND')
  assert.ok(payload.blockedUntil)

  const jobs = await listReportAnalysisJobs(user.id)
  assert.equal(jobs.length, 1)
})