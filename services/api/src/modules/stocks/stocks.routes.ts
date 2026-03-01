import { FastifyInstance } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import { getQuote, getHistory, getAssetMetadata, listStocks } from './stocks.service'
import {
  stockSymbolParamsSchema,
  stockHistoryQuerySchema,
  stockListQuerySchema,
} from './stocks.schema'

export async function stocksRoutes(fastify: FastifyInstance) {
  // ----------------------------------------------------------------
  // GET /v1/stocks
  // Listagem paginada de ativos com filtro por tipo (stock/fund/bdr)
  // ----------------------------------------------------------------
  fastify.get<{ Querystring: Record<string, string> }>(
    '/stocks',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Stocks'],
        summary: 'Listar ativos da B3',
        description:
          'Lista ativos negociados na B3 com suporte a filtro por tipo (ações, FIIs, BDRs), ' +
          'busca por ticker, setor, ordenação e paginação. ' +
          'Resultado cacheado no Redis por 5 minutos.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['stock', 'fund', 'bdr'],
              description: 'Tipo do ativo — stock (ações), fund (FIIs), bdr',
            },
            search: {
              type: 'string',
              description: 'Busca parcial por ticker (ex: PETR encontra PETR3 e PETR4)',
            },
            sector: {
              type: 'string',
              description: 'Filtro por setor (ex: Finance, Energy Minerals)',
            },
            sortBy: {
              type: 'string',
              enum: ['name', 'close', 'change', 'change_abs', 'volume', 'market_cap_basic', 'sector'],
              description: 'Campo de ordenação',
            },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'asc',
              description: 'Direção da ordenação',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
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
                items: { type: 'object', additionalProperties: true },
              },
              currentPage: { type: 'integer' },
              totalPages: { type: 'integer' },
              totalCount: { type: 'integer' },
              hasNextPage: { type: 'boolean' },
              availableSectors: { type: 'array', items: { type: 'string' } },
              availableStockTypes: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const query = stockListQuerySchema.parse(request.query)
      const data = await listStocks(query)
      return reply.send(data)
    },
  )

  // ----------------------------------------------------------------
  // GET /v1/stocks/:symbol
  // Cotação atual do ativo (autenticado)
  // ----------------------------------------------------------------
  fastify.get<{ Params: { symbol: string } }>(
    '/stocks/:symbol',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Stocks'],
        summary: 'Cotação atual',
        description:
          'Retorna o preço atual e dados de mercado de um ativo da B3. ' +
          'Resultado cacheado no Redis (2 min durante o pregão / 30 min fora).',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Ticker do ativo (ex: PETR4, BOVA11)' },
          },
          required: ['symbol'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              quote: { type: 'object', additionalProperties: true },
            },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const { symbol } = stockSymbolParamsSchema.parse(request.params)
      const quote = await getQuote(symbol)
      return reply.send({ quote })
    },
  )

  // ----------------------------------------------------------------
  // GET /v1/stocks/:symbol/history
  // Série histórica OHLCV (autenticado)
  // ----------------------------------------------------------------
  fastify.get<{ Params: { symbol: string }; Querystring: { range?: string; interval?: string } }>(
    '/stocks/:symbol/history',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Stocks'],
        summary: 'Histórico de preços',
        description:
          'Retorna a série histórica OHLCV (candlestick) de um ativo. ' +
          'Resultado cacheado no Redis por 1 hora.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Ticker do ativo' },
          },
          required: ['symbol'],
        },
        querystring: {
          type: 'object',
          properties: {
            range: {
              type: 'string',
              enum: ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'],
              default: '1mo',
              description: 'Período do histórico',
            },
            interval: {
              type: 'string',
              enum: ['1d', '1wk', '1mo'],
              default: '1d',
              description: 'Intervalo de cada vela',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const { symbol } = stockSymbolParamsSchema.parse(request.params)
      const query = stockHistoryQuerySchema.parse(request.query)
      const { historicalDataPrice, ...rest } = await getHistory(symbol, query)
      return reply.send({ ...rest, history: historicalDataPrice })
    },
  )

  // ----------------------------------------------------------------
  // GET /v1/stocks/:symbol/metadata
  // Dados fundamentalistas do ativo (autenticado)
  // ----------------------------------------------------------------
  fastify.get<{ Params: { symbol: string } }>(
    '/stocks/:symbol/metadata',
    {
      preHandler: authenticate,
      schema: {
        tags: ['Stocks'],
        summary: 'Metadados do ativo',
        description:
          'Retorna nome, setor e dados fundamentalistas de um ativo. ' +
          'Resultado cacheado no Redis por 24 horas.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Ticker do ativo' },
          },
          required: ['symbol'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              metadata: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { symbol } = stockSymbolParamsSchema.parse(request.params)
      const metadata = await getAssetMetadata(symbol)
      return reply.send({ metadata })
    },
  )
}
