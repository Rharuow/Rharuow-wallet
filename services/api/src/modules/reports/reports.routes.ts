import { FastifyInstance, FastifyReply } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import {
  createManualReportAnalysisSchema,
  createReportAnalysisSchema,
  reportAnalysisParamsSchema,
} from './reports.schema'
import {
  createManualReportAnalysis,
  createOnDemandReportAnalysis,
  getUserAccessibleReportAnalysis,
} from './reports.service'

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
      source: {
        id: access.analysis.source.id,
        sourceKind: access.analysis.source.sourceKind,
        sourceUrl: access.analysis.source.sourceUrl,
        originalFileName: access.analysis.source.originalFileName,
      },
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
      source: {
        id: result.analysis.source.id,
        sourceKind: result.analysis.source.sourceKind,
        sourceUrl: result.analysis.source.sourceUrl,
        originalFileName: result.analysis.source.originalFileName,
      },
    },
  }
}

function handleServiceError(error: unknown, reply: FastifyReply) {
  const err = error as Error & { statusCode?: number }
  return reply.status(err.statusCode ?? 500).send({ error: err.message ?? 'INTERNAL_SERVER_ERROR' })
}

export async function reportsRoutes(fastify: FastifyInstance) {
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