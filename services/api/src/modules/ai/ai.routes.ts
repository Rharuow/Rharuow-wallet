import { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../plugins/authenticate'
import { generateInsights, userIsPremium, analyzeStock, analyzeFii, suggestBudgetGoals, scoreFinancialHealth, type BudgetGoalsInput, type HealthScoreInput } from './ai.service'

function handleServiceError(err: unknown, reply: FastifyReply) {
  const e = err as Error & { statusCode?: number }
  return reply.status(e.statusCode ?? 500).send({ error: e.message })
}

const InsightsBodySchema = z.object({
  type: z.enum(['costs', 'incomes']),
  period: z.object({
    dateFrom: z.string(),
    dateTo: z.string(),
  }),
  analytics: z.record(z.unknown()),
  costTotal: z.number().optional(),
})

export async function aiRoutes(fastify: FastifyInstance) {
  // POST /v1/ai/insights — gera insights financeiros com IA
  fastify.post('/insights', {
    preHandler: authenticate,
    schema: {
      tags: ['AI'],
      summary: 'Gerar insights financeiros com IA (Premium)',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const userId = (request.user as { sub: string }).sub

      const isPremium = await userIsPremium(userId)
      if (!isPremium) {
        return reply.status(403).send({ error: 'Funcionalidade exclusiva para usuários Premium.' })
      }

      const body = InsightsBodySchema.parse(request.body)

      const insights = await generateInsights(userId, {
        type: body.type,
        period: body.period,
        analytics: body.analytics as any,
        costTotal: body.costTotal,
      })

      return reply.send({ insights })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  // POST /v1/ai/stock-analysis — analisa ativo (Stock) com IA
  const StockAnalysisBodySchema = z.object({
    ticker: z.string().min(3).max(10),
  })

  fastify.post('/stock-analysis', {
    preHandler: authenticate,
    schema: {
      tags: ['AI'],
      summary: 'Analisar ativo (Stock) com IA (Premium)',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const userId = (request.user as { sub: string }).sub

      const isPremium = await userIsPremium(userId)
      if (!isPremium) {
        return reply.status(403).send({ error: 'Funcionalidade exclusiva para usuários Premium.' })
      }

      const { ticker } = StockAnalysisBodySchema.parse(request.body)
      const analysis = await analyzeStock(userId, ticker)
      return reply.send({ analysis })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  // POST /v1/ai/fii-analysis — analisa FII com IA
  const FiiAnalysisBodySchema = z.object({
    papel: z.string().min(4).max(10),
  })

  fastify.post('/fii-analysis', {
    preHandler: authenticate,
    schema: {
      tags: ['AI'],
      summary: 'Analisar FII com IA (Premium)',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const userId = (request.user as { sub: string }).sub

      const isPremium = await userIsPremium(userId)
      if (!isPremium) {
        return reply.status(403).send({ error: 'Funcionalidade exclusiva para usuários Premium.' })
      }

      const { papel } = FiiAnalysisBodySchema.parse(request.body)
      const analysis = await analyzeFii(userId, papel)
      return reply.send({ analysis })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  // POST /v1/ai/budget-goals — sugere metas de orçamento por área (Premium)
  const BudgetGoalsBodySchema = z.object({
    period: z.object({ dateFrom: z.string(), dateTo: z.string() }),
    summary: z.object({ total: z.number(), count: z.number(), average: z.number() }),
    byArea: z.array(z.object({ areaId: z.string(), areaName: z.string(), total: z.number() })),
    byMonth: z.array(z.object({ month: z.string(), total: z.number() })),
    incomeTotal: z.number(),
  })

  fastify.post('/budget-goals', {
    preHandler: authenticate,
    schema: {
      tags: ['AI'],
      summary: 'Sugerir metas de orçamento por área com IA (Premium)',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const userId = (request.user as { sub: string }).sub

      const isPremium = await userIsPremium(userId)
      if (!isPremium) {
        return reply.status(403).send({ error: 'Funcionalidade exclusiva para usuários Premium.' })
      }

      const input = BudgetGoalsBodySchema.parse(request.body) as BudgetGoalsInput
      const suggestions = await suggestBudgetGoals(userId, input)
      return reply.send({ suggestions })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })

  // POST /v1/ai/financial-health — gera score de saúde financeira (Premium)
  const CostsSummarySchema = z.object({ total: z.number(), count: z.number(), average: z.number() })
  const ByMonthSchema = z.array(z.object({ month: z.string(), total: z.number() }))
  const ByAreaSchema  = z.array(z.object({ areaId: z.string(), areaName: z.string(), total: z.number() }))
  const ByTypeIncomeSchema = z.array(z.object({ type: z.string(), label: z.string(), total: z.number(), count: z.number() }))

  const HealthScoreBodySchema = z.object({
    period: z.object({ dateFrom: z.string(), dateTo: z.string() }),
    costs: z.object({
      summary: CostsSummarySchema,
      byArea: ByAreaSchema,
      byMonth: ByMonthSchema,
    }),
    incomes: z.object({
      summary: CostsSummarySchema,
      byMonth: ByMonthSchema,
      byType: ByTypeIncomeSchema,
    }),
  })

  fastify.post('/financial-health', {
    preHandler: authenticate,
    schema: {
      tags: ['AI'],
      summary: 'Gerar score de saúde financeira com IA (Premium)',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const userId = (request.user as { sub: string }).sub

      const isPremium = await userIsPremium(userId)
      if (!isPremium) {
        return reply.status(403).send({ error: 'Funcionalidade exclusiva para usuários Premium.' })
      }

      const input = HealthScoreBodySchema.parse(request.body) as HealthScoreInput
      const result = await scoreFinancialHealth(userId, input)
      return reply.send({ result })
    } catch (err) {
      return handleServiceError(err, reply)
    }
  })
}
