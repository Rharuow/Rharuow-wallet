import { FastifyInstance } from 'fastify'
import { authenticate } from '../../plugins/authenticate'
import { listFiis, getFii } from './fiis.service'
import { fiiListQuerySchema, FII_SORT_FIELDS } from './fiis.schema'

export async function fiisRoutes(fastify: FastifyInstance) {
  // ----------------------------------------------------------------
  // GET /v1/fiis
  // Listagem paginada de FIIs com filtros e ordenação completa
  // ----------------------------------------------------------------
  fastify.get<{ Querystring: Record<string, string> }>(
    '/fiis',
    {
      preHandler: authenticate,
      schema: {
        tags: ['FIIs'],
        summary: 'Listar Fundos de Investimento Imobiliário',
        description:
          'Lista todos os FIIs negociados na B3 com dados do Fundamentus.com.br. ' +
          'Suporta filtro por ticker/segmento, ordenação por qualquer coluna e paginação. ' +
          'O resultado completo é cacheado no Redis (10 min durante o pregão / 1 h fora).',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            search: {
              type: 'string',
              description: 'Busca parcial por ticker ou segmento (case-insensitive)',
            },
            segmento: {
              type: 'string',
              description: 'Filtro exato por segmento (ex: Logística, Shoppings)',
            },
            sortBy: {
              type: 'string',
              enum: [...FII_SORT_FIELDS],
              default: 'papel',
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
              description: 'Itens por página (máx 100)',
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
              fiis: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    papel: { type: 'string', description: 'Ticker (ex: MXRF11)' },
                    segmento: { type: 'string', description: 'Segmento do fundo' },
                    cotacao: { type: 'number', nullable: true, description: 'Cotação (R$)' },
                    ffoYield: { type: 'number', nullable: true, description: 'FFO Yield (%)' },
                    dividendYield: { type: 'number', nullable: true, description: 'Dividend Yield (%)' },
                    pvp: { type: 'number', nullable: true, description: 'P/VP' },
                    valorMercado: { type: 'number', nullable: true, description: 'Valor de mercado (R$)' },
                    liquidez: { type: 'number', nullable: true, description: 'Liquidez média diária (R$)' },
                    qtdImoveis: { type: 'number', nullable: true, description: 'Qtd de imóveis' },
                    precoM2: { type: 'number', nullable: true, description: 'Preço por m² (R$)' },
                    aluguelM2: { type: 'number', nullable: true, description: 'Aluguel por m² (R$)' },
                    capRate: { type: 'number', nullable: true, description: 'Cap Rate (%)' },
                    vacanciaMedia: { type: 'number', nullable: true, description: 'Vacância média (%)' },
                  },
                },
              },
              currentPage: { type: 'integer' },
              totalPages: { type: 'integer' },
              totalCount: { type: 'integer' },
              hasNextPage: { type: 'boolean' },
              segmentos: {
                type: 'array',
                items: { type: 'string' },
                description: 'Segmentos disponíveis para filtro',
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const query = fiiListQuerySchema.parse(request.query)
      const data = await listFiis(query)
      return reply.send(data)
    },
  )

  // ----------------------------------------------------------------
  // GET /v1/fiis/:papel
  // Detalhes de um FII específico pelo ticker
  // ----------------------------------------------------------------
  fastify.get<{ Params: { papel: string } }>(
    '/fiis/:papel',
    {
      preHandler: authenticate,
      schema: {
        tags: ['FIIs'],
        summary: 'Detalhes de um FII',
        description:
          'Retorna todos os dados fundamentalistas de um FII pelo ticker. ' +
          'Utiliza o mesmo cache da listagem completa.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            papel: { type: 'string', description: 'Ticker do FII (ex: MXRF11)' },
          },
          required: ['papel'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              fii: { type: 'object', additionalProperties: true },
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
      const { papel } = request.params
      const fii = await getFii(papel)

      if (!fii) {
        return reply.status(404).send({ error: `FII "${papel.toUpperCase()}" não encontrado` })
      }

      return reply.send({ fii })
    },
  )
}
