import { z } from 'zod'

// ----------------------------------------------------------------
// Colunas disponíveis para ordenação — espelham FundamentusFii
// ----------------------------------------------------------------

export const FII_SORT_FIELDS = [
  'papel',
  'segmento',
  'cotacao',
  'ffoYield',
  'dividendYield',
  'pvp',
  'valorMercado',
  'liquidez',
  'qtdImoveis',
  'precoM2',
  'aluguelM2',
  'capRate',
  'vacanciaMedia',
] as const

export type FiiSortField = (typeof FII_SORT_FIELDS)[number]

// ----------------------------------------------------------------
// Query params de listagem
// ----------------------------------------------------------------

export const fiiListQuerySchema = z.object({
  /** Busca parcial por ticker ou segmento (case-insensitive) */
  search: z.string().optional().describe('Busca parcial por ticker ou segmento'),

  /** Filtro exato por segmento */
  segmento: z.string().optional().describe('Filtro por segmento (ex: Logística, Shoppings)'),

  /** Campo de ordenação */
  sortBy: z
    .enum(FII_SORT_FIELDS)
    .optional()
    .default('papel')
    .describe('Campo de ordenação'),

  /** Direção da ordenação */
  sortOrder: z
    .enum(['asc', 'desc'])
    .optional()
    .default('asc')
    .describe('Direção da ordenação'),

  /** Itens por página (1–100) */
  limit: z
    .coerce.number().int().min(1).max(100)
    .optional()
    .default(20)
    .describe('Itens por página (máx 100)'),

  /** Página atual (1-based) */
  page: z
    .coerce.number().int().min(1)
    .optional()
    .default(1)
    .describe('Número da página'),
})

export type FiiListQuery = z.infer<typeof fiiListQuerySchema>

// ----------------------------------------------------------------
// Schema do item de FII
// ----------------------------------------------------------------

export const fiiItemSchema = z.object({
  papel: z.string().describe('Ticker do FII (ex: MXRF11)'),
  segmento: z.string().describe('Segmento do fundo'),
  cotacao: z.number().nullable().describe('Cotação atual (R$)'),
  ffoYield: z.number().nullable().describe('FFO Yield (%)'),
  dividendYield: z.number().nullable().describe('Dividend Yield (%)'),
  pvp: z.number().nullable().describe('P/VP — Preço sobre Valor Patrimonial'),
  valorMercado: z.number().nullable().describe('Valor de mercado (R$)'),
  liquidez: z.number().nullable().describe('Liquidez média diária (R$)'),
  qtdImoveis: z.number().nullable().describe('Quantidade de imóveis'),
  precoM2: z.number().nullable().describe('Preço por m² (R$)'),
  aluguelM2: z.number().nullable().describe('Aluguel por m² (R$)'),
  capRate: z.number().nullable().describe('Cap Rate (%)'),
  vacanciaMedia: z.number().nullable().describe('Vacância média (%)'),
})

export type FiiItem = z.infer<typeof fiiItemSchema>

// ----------------------------------------------------------------
// Schema da resposta de listagem
// ----------------------------------------------------------------

export const fiiListResponseSchema = z.object({
  fiis: z.array(fiiItemSchema),
  currentPage: z.number(),
  totalPages: z.number(),
  totalCount: z.number(),
  hasNextPage: z.boolean(),
  segmentos: z.array(z.string()).describe('Lista de segmentos disponíveis'),
})

export type FiiListResponse = z.infer<typeof fiiListResponseSchema>
