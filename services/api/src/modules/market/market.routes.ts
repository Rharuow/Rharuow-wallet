import { FastifyInstance } from 'fastify'
import { fetchMarketOverview } from './market.service'

export async function marketRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/market',
    {
      schema: {
        tags: ['Market'],
        summary: 'Visão geral do mercado',
        description:
          'Retorna cotações e histórico de USD, EUR, BTC e Ibovespa. ' +
          'Resultado cacheado no Redis por 30 min.',
        response: {
          200: {
            type: 'object',
            properties: {
              assets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    name: { type: 'string' },
                    symbol: { type: 'string' },
                    value: { type: 'number' },
                    change: { type: 'number' },
                    history: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          date: { type: 'string' },
                          value: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      const assets = await fetchMarketOverview()
      return { assets }
    },
  )
}
