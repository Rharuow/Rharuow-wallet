import { FastifyInstance } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import { listStocks, getStockDetail, listSegments } from './stocks.service'
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

  // ----------------------------------------------------------------
  // GET /v1/stocks/segments
  // Lista todos os segmentos com tradução PT-BR
  // ----------------------------------------------------------------
  fastify.get(
    '/stocks/segments',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Stocks'],
        summary: 'Listar segmentos de ações',
        description:
          'Retorna todos os segmentos cadastrados com o nome original em inglês (retornado pela brapi) ' +
          'e a tradução em português, ordenados alfabeticamente pelo nome em PT-BR.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nameEn: { type: 'string', description: 'Nome em inglês (usado para filtrar na brapi)' },
                namePt: { type: 'string', description: 'Nome em português (exibido no frontend)' },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const segments = await listSegments()
      return reply.send(segments)
    },
  )

  // ----------------------------------------------------------------
  // GET /v1/stocks/:ticker
  // Detalhe completo de uma ação
  // ----------------------------------------------------------------
  fastify.get<{ Params: { ticker: string } }>(
    '/stocks/:ticker',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Stocks'],
        summary: 'Detalhe de uma ação',
        description:
          'Retorna dados completos de uma ação: cotação, perfil, indicadores financeiros e estatísticas. ' +
          'Fonte: brapi.dev com módulos summaryProfile, financialData e defaultKeyStatistics. ' +
          'Resultado cacheado no Redis por 60 s.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            ticker: { type: 'string', description: 'Ticker da ação (ex: PETR4)' },
          },
          required: ['ticker'],
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { ticker } = request.params
      const detail = await getStockDetail(ticker)

      if (!detail) {
        return reply.status(404).send({ error: `Ação "${ticker.toUpperCase()}" não encontrada` })
      }

      return reply.send(detail)
    },
  )
}
