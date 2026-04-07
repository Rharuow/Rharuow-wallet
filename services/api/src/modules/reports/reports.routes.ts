import { FastifyInstance, FastifyReply } from 'fastify'
import { Prisma, ReportAnalysisJobStatus } from '@prisma/client'
import { authenticate } from '../../plugins/authenticate'
import {
  createManualReportJobSchema,
  createManualReportAnalysisSchema,
  createReportJobSchema,
  createReportAnalysisSchema,
  reportJobParamsSchema,
  reportAnalysisParamsSchema,
} from './reports.schema'
import {
  createReportAnalysisJob,
  listReportAnalysisJobs,
  findActiveReportSearchCooldown,
  getReportAnalysisJobById,
  updateReportAnalysisJobStatus,
} from './report-jobs.service'
import {
  createManualReportAnalysis,
  createOnDemandReportAnalysis,
  getUserAccessibleReportAnalysis,
  storeManualUploadObject,
} from './reports.service'
import {
  publishReportAnalysisRequested,
} from './report-jobs.queue'

type ReportJobRecord = Awaited<ReturnType<typeof getReportAnalysisJobById>>
type ExistingReportJob = NonNullable<ReportJobRecord>
type CreatedReportJob = Awaited<ReturnType<typeof createReportAnalysisJob>>
type ListedReportJob = Awaited<ReturnType<typeof listReportAnalysisJobs>>[number]
type ReportJob = ExistingReportJob | CreatedReportJob | ListedReportJob

function serializeSource(source: {
  id: string
  sourceKind: string
  sourceUrl: string | null
  originalFileName: string | null
  metadata: Prisma.JsonValue | null
}) {
  const metadata = (source.metadata ?? null) as Record<string, unknown> | null

  return {
    id: source.id,
    sourceKind: source.sourceKind,
    sourceUrl: source.sourceUrl,
    originalFileName: source.originalFileName,
    title: typeof metadata?.title === 'string' ? metadata.title : null,
    publisher: typeof metadata?.publisher === 'string' ? metadata.publisher : null,
    sourceType: typeof metadata?.sourceType === 'string' ? metadata.sourceType : null,
    discoveryMethod: typeof metadata?.discoveryMethod === 'string' ? metadata.discoveryMethod : null,
  }
}

function serializeAnalysis(access: NonNullable<Awaited<ReturnType<typeof getUserAccessibleReportAnalysis>>>) {
  return {
    access: {
      id: access.id,
      expiresAt: access.expiresAt,
    },
    analysis: {
      id: access.analysis.id,
      assetType: access.analysis.assetType,
      ticker: access.analysis.ticker,
      analysisText: access.analysis.analysisText,
      model: access.analysis.model,
      validUntil: access.analysis.validUntil,
      source: serializeSource(access.analysis.source),
    },
  }
}

function serializeCreateResult(result: Awaited<ReturnType<typeof createOnDemandReportAnalysis>>) {
  return {
    outcome: result.outcome,
    chargedAmount: result.chargedAmount,
    plan: result.plan,
    balance: {
      id: result.balance.id,
      balance: result.balance.balance.toString(),
      updatedAt: result.balance.updatedAt,
    },
    access: {
      id: result.access.id,
      expiresAt: result.access.expiresAt,
    },
    analysis: {
      id: result.analysis.id,
      assetType: result.analysis.assetType,
      ticker: result.analysis.ticker,
      analysisText: result.analysis.analysisText,
      model: result.analysis.model,
      validUntil: result.analysis.validUntil,
      source: serializeSource(result.analysis.source),
    },
  }
}

function handleServiceError(error: unknown, reply: FastifyReply) {
  const err = error as Error & { statusCode?: number }
  return reply.status(err.statusCode ?? 500).send({ error: err.message ?? 'INTERNAL_SERVER_ERROR' })
}

async function markJobDispatchFailure(jobId: string, error: unknown) {
  const err = error as Error & { statusCode?: number }

  try {
    await updateReportAnalysisJobStatus({
      jobId,
      status: ReportAnalysisJobStatus.FAILED,
      failureCode: 'REPORT_JOB_DISPATCH_FAILED',
      failureMessage: err.message ?? 'REPORT_JOB_DISPATCH_FAILED',
    })
  } catch {
    return
  }
}

function serializeJob(job: ReportJob) {
  return {
    id: job.id,
    userId: job.userId,
    assetType: job.assetType,
    ticker: job.ticker,
    requestMode: job.requestMode,
    status: job.status,
    attemptCount: job.attemptCount,
    failureCode: job.failureCode,
    failureMessage: job.failureMessage,
    priceCharged: job.priceCharged?.toString() ?? null,
    analysisId: job.analysisId,
    sourceId: job.sourceId,
    lockedAt: job.lockedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    metadata: job.metadata,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

export async function reportsRoutes(fastify: FastifyInstance) {
  fastify.post('/jobs', {
    preHandler: authenticate,
    schema: {
      tags: ['Reports'],
      summary: 'Criar job assíncrono de relatório com busca automática',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    let jobId: string | null = null

    try {
      const userId = (request.user as { sub: string }).sub
      const body = createReportJobSchema.parse(request.body)

      const cooldown = await findActiveReportSearchCooldown({
        assetType: body.assetType,
        ticker: body.ticker,
      })

      if (cooldown) {
        return reply.status(409).send({
          error: 'REPORT_AUTO_SEARCH_COOLDOWN_ACTIVE',
          blockedUntil: cooldown.blockedUntil,
          reasonCode: cooldown.reasonCode,
        })
      }

      const job = await createReportAnalysisJob({
        userId,
        assetType: body.assetType,
        ticker: body.ticker,
        requestMode: 'AUTO_WEB',
      })
      jobId = job.id

      await publishReportAnalysisRequested({
        jobId: job.id,
        userId,
        assetType: job.assetType,
        ticker: job.ticker,
        requestMode: job.requestMode,
      })

      request.log.info({
        requestId: request.id,
        userId,
        action: 'reports.jobs.create.auto',
        jobId: job.id,
        assetType: body.assetType,
        ticker: body.ticker,
      }, 'report analysis job created')

      return reply.status(202).send({ job: serializeJob(job) })
    } catch (error) {
      if (jobId) {
        await markJobDispatchFailure(jobId, error)
      }

      const userId = (request.user as { sub: string } | undefined)?.sub
      request.log.error({
        err: error,
        requestId: request.id,
        userId,
        action: 'reports.jobs.create.auto',
      }, 'report analysis job creation failed')
      return handleServiceError(error, reply)
    }
  })

  fastify.post('/jobs/manual', {
    preHandler: authenticate,
    schema: {
      tags: ['Reports'],
      summary: 'Criar job assíncrono de relatório com upload manual',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    let jobId: string | null = null

    try {
      const userId = (request.user as { sub: string }).sub
      const body = createManualReportJobSchema.parse(request.body)
      const storedUpload = await storeManualUploadObject({
        assetType: body.assetType,
        ticker: body.ticker,
        originalFileName: body.originalFileName,
        contentType: body.contentType,
        fileBase64: body.fileBase64,
      })

      const job = await createReportAnalysisJob({
        userId,
        assetType: body.assetType,
        ticker: body.ticker,
        requestMode: 'MANUAL_UPLOAD',
        metadata: {
          originalFileName: body.originalFileName,
          contentType: body.contentType ?? null,
          storageKey: storedUpload.storageKey,
          fileSizeBytes: storedUpload.fileSizeBytes,
        },
      })
      jobId = job.id

      await publishReportAnalysisRequested({
        jobId: job.id,
        userId,
        assetType: job.assetType,
        ticker: job.ticker,
        requestMode: job.requestMode,
      })

      request.log.info({
        requestId: request.id,
        userId,
        action: 'reports.jobs.create.manual',
        jobId: job.id,
        assetType: body.assetType,
        ticker: body.ticker,
      }, 'manual report analysis job created')

      return reply.status(202).send({ job: serializeJob(job) })
    } catch (error) {
      if (jobId) {
        await markJobDispatchFailure(jobId, error)
      }

      const userId = (request.user as { sub: string } | undefined)?.sub
      request.log.error({
        err: error,
        requestId: request.id,
        userId,
        action: 'reports.jobs.create.manual',
      }, 'manual report analysis job creation failed')
      return handleServiceError(error, reply)
    }
  })

  fastify.get('/jobs', {
    preHandler: authenticate,
    schema: {
      tags: ['Reports'],
      summary: 'Listar jobs assíncronos de relatório do usuário',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const userId = (request.user as { sub: string }).sub
      const jobs = await listReportAnalysisJobs(userId)

      request.log.info({
        requestId: request.id,
        userId,
        action: 'reports.jobs.list',
        count: jobs.length,
      }, 'report analysis jobs listed')

      return reply.send({ jobs: jobs.map((job: (typeof jobs)[number]) => serializeJob(job)) })
    } catch (error) {
      const userId = (request.user as { sub: string } | undefined)?.sub
      request.log.error({
        err: error,
        requestId: request.id,
        userId,
        action: 'reports.jobs.list',
      }, 'report analysis jobs list failed')
      return handleServiceError(error, reply)
    }
  })

  fastify.get('/jobs/:id', {
    preHandler: authenticate,
    schema: {
      tags: ['Reports'],
      summary: 'Consultar um job assíncrono de relatório por id',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const userId = (request.user as { sub: string }).sub
      const params = reportJobParamsSchema.parse(request.params)
      const job = await getReportAnalysisJobById(params.id)

      if (!job || job.userId !== userId) {
        request.log.warn({
          requestId: request.id,
          userId,
          action: 'reports.jobs.get',
          jobId: params.id,
        }, 'report analysis job not found for user')
        return reply.status(404).send({ error: 'REPORT_ANALYSIS_JOB_NOT_FOUND' })
      }

      request.log.info({
        requestId: request.id,
        userId,
        action: 'reports.jobs.get',
        jobId: params.id,
      }, 'report analysis job fetched')

      return reply.send({ job: serializeJob(job) })
    } catch (error) {
      const userId = (request.user as { sub: string } | undefined)?.sub
      request.log.error({
        err: error,
        requestId: request.id,
        userId,
        action: 'reports.jobs.get',
      }, 'report analysis job fetch failed')
      return handleServiceError(error, reply)
    }
  })

  fastify.post('/analysis', {
    preHandler: authenticate,
    schema: {
      tags: ['Reports'],
      summary: 'Gerar ou reutilizar análise on-demand de relatório por ticker',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const userId = (request.user as { sub: string }).sub
      const rawBody = request.body as Record<string, unknown>

      if (rawBody.manualUpload === true) {
        const body = createManualReportAnalysisSchema.parse({
          assetType: rawBody.assetType,
          ticker: rawBody.ticker,
          originalFileName: rawBody.originalFileName,
          contentType: rawBody.contentType,
          fileBase64: rawBody.fileBase64,
        })
        const result = await createManualReportAnalysis({
          userId,
          assetType: body.assetType,
          ticker: body.ticker,
          originalFileName: body.originalFileName,
          contentType: body.contentType,
          fileBase64: body.fileBase64,
        })

        request.log.info({
          requestId: request.id,
          userId,
          action: 'reports.analysis.manual',
          assetType: body.assetType,
          ticker: body.ticker,
          originalFileName: body.originalFileName,
          outcome: result.outcome,
          sourceKind: result.analysis.source.sourceKind,
        }, 'manual reports analysis processed')

        return reply.send(serializeCreateResult(result))
      }

      const body = createReportAnalysisSchema.parse(rawBody)
      const result = await createOnDemandReportAnalysis({
        userId,
        assetType: body.assetType,
        ticker: body.ticker,
      })

      request.log.info({
        requestId: request.id,
        userId,
        action: 'reports.analysis.auto',
        assetType: body.assetType,
        ticker: body.ticker,
        outcome: result.outcome,
        sourceKind: result.analysis.source.sourceKind,
      }, 'reports analysis processed')

      return reply.send(serializeCreateResult(result))
    } catch (error) {
      const userId = (request.user as { sub: string } | undefined)?.sub
      request.log.error({
        err: error,
        requestId: request.id,
        userId,
        action: 'reports.analysis.auto',
      }, 'reports analysis failed')
      return handleServiceError(error, reply)
    }
  })

  fastify.post('/analysis/manual', {
    preHandler: authenticate,
    schema: {
      tags: ['Reports'],
      summary: 'Gerar ou reutilizar análise on-demand a partir de upload manual',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const userId = (request.user as { sub: string }).sub
      const body = createManualReportAnalysisSchema.parse(request.body)
      const result = await createManualReportAnalysis({
        userId,
        assetType: body.assetType,
        ticker: body.ticker,
        originalFileName: body.originalFileName,
        contentType: body.contentType,
        fileBase64: body.fileBase64,
      })

      request.log.info({
        requestId: request.id,
        userId,
        action: 'reports.analysis.manual',
        assetType: body.assetType,
        ticker: body.ticker,
        originalFileName: body.originalFileName,
        outcome: result.outcome,
        sourceKind: result.analysis.source.sourceKind,
      }, 'manual reports analysis processed')

      return reply.send(serializeCreateResult(result))
    } catch (error) {
      const userId = (request.user as { sub: string } | undefined)?.sub
      request.log.error({
        err: error,
        requestId: request.id,
        userId,
        action: 'reports.analysis.manual',
      }, 'manual reports analysis failed')
      return handleServiceError(error, reply)
    }
  })

  fastify.get('/analysis/:id', {
    preHandler: authenticate,
    schema: {
      tags: ['Reports'],
      summary: 'Consultar uma análise on-demand acessível ao usuário',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const userId = (request.user as { sub: string }).sub
      const params = reportAnalysisParamsSchema.parse(request.params)
      const access = await getUserAccessibleReportAnalysis({
        userId,
        analysisId: params.id,
      })

      if (!access) {
        request.log.warn({
          requestId: request.id,
          userId,
          action: 'reports.analysis.get',
          analysisId: params.id,
        }, 'report analysis access not found')
        return reply.status(404).send({ error: 'REPORT_ANALYSIS_ACCESS_NOT_FOUND' })
      }

      request.log.info({
        requestId: request.id,
        userId,
        action: 'reports.analysis.get',
        analysisId: params.id,
      }, 'report analysis fetched')

      return reply.send(serializeAnalysis(access))
    } catch (error) {
      const userId = (request.user as { sub: string } | undefined)?.sub
      request.log.error({
        err: error,
        requestId: request.id,
        userId,
        action: 'reports.analysis.get',
      }, 'report analysis fetch failed')
      return handleServiceError(error, reply)
    }
  })
}