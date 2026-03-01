import { FastifyInstance } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import { getUserHoldings } from './portfolio.service'

export async function portfolioRoutes(fastify: FastifyInstance) {
  /**
   * GET /v1/portfolio
   * Retorna os holdings (posições) do usuário autenticado.
   * Integração com dados em tempo real da B3 será adicionada na próxima fase.
   */
  fastify.get(
    '/',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Portfolio'],
        summary: 'Posições do portfólio',
        description: 'Retorna os holdings (posições) do usuário autenticado.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              holdings: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const holdings = await getUserHoldings(request.user.sub)
      return reply.send({ holdings })
    },
  )
}

