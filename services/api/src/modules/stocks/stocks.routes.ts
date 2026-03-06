import { FastifyInstance } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import { listStocks } from './stocks.service'
import { StockListQuerySchema, STOCK_SORT_FIELDS } from './stocks.schema'

export async function stocksRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: Record<string, string> }>(
    '/stocks',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Stocks'],
        summary: 'Listar ações da B3',
        description:
          'Lista ações da B3 via brapi.dev. ' +
          'Ordenação, filtros e paginação são processados nativamente pela brapi. ' +
          'Resultado cacheado no Redis por 60 s.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            search: {
              type: 'string',
              description: 'Busca parcial pelo ticker (ex: PETR)',
            },
            sector: {
              type: 'string',
              description: 'Filtro por setor (ex: Energy Minerals)',
            },
            sortBy: {
              type: 'string',
              enum: [...STOCK_SORT_FIELDS],
              default: 'market_cap_basic',
              description: 'Campo de ordenação',
            },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
              description: 'Direção da ordenação',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 12,
              description: 'Itens por página',
            },
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
              description: 'Número da página',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              stocks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    stock: { type: 'string', description: 'Ticker (ex: PETR4)' },
                    name: { type: 'string', description: 'Nome da empresa' },
                    close: { type: 'number', description: 'Cotação (R$)' },
                    change: { type: 'number', description: 'Variação (%)' },
                    volume: { type: 'number', description: 'Volume negociado' },
                    market_cap: { type: 'number', nullable: true, description: 'Valor de mercado (R$)' },
                    sector: { type: 'string', nullable: true, description: 'Setor' },
                    type: { type: 'string', description: 'Tipo (stock/fund/bdr)' },
                    logo: { type: 'string', description: 'URL do logo' },
                  },
                },
              },
              availableSectors: {
                type: 'array',
                items: { type: 'string' },
                description: 'Setores disponíveis para filtro',
              },
              currentPage: { type: 'integer' },
              totalPages: { type: 'integer' },
              itemsPerPage: { type: 'integer' },
              totalCount: { type: 'integer' },
              hasNextPage: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const query = StockListQuerySchema.parse(request.query)
      const data = await listStocks(query)
      return reply.send(data)
    },
  )
}
