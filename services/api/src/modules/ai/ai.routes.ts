import { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../plugins/authenticate'
import { generateInsights, userIsPremium } from './ai.service'

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
}
