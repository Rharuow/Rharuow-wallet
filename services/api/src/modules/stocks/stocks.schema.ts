import { z } from 'zod'

// ----------------------------------------------------------------
// Parâmetros de rota
// ----------------------------------------------------------------

export const stockSymbolParamsSchema = z.object({
  symbol: z
    .string()
    .min(4)
    .max(6)
    .toUpperCase()
    .describe('Ticker do ativo (ex: PETR4, MXRF11, BOVA11)'),
})

export const stockHistoryQuerySchema = z.object({
  range: z
    .enum(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'])
    .default('1mo')
    .describe('Período do histórico'),
  interval: z
    .enum(['1d', '1wk', '1mo'])
    .default('1d')
    .describe('Intervalo das velas'),
})

export type StockSymbolParams = z.infer<typeof stockSymbolParamsSchema>
export type StockHistoryQuery = z.infer<typeof stockHistoryQuerySchema>

// ----------------------------------------------------------------
// Resposta da brapi.dev — cotação
// ----------------------------------------------------------------

export const brapiQuoteResultSchema = z.object({
  symbol: z.string(),
  shortName: z.string().nullable().optional(),
  longName: z.string().nullable().optional(),
  currency: z.string().optional(),
  regularMarketPrice: z.number(),
  regularMarketChange: z.number(),
  regularMarketChangePercent: z.number(),
  regularMarketDayHigh: z.number().nullable().optional(),
  regularMarketDayLow: z.number().nullable().optional(),
  regularMarketVolume: z.number().nullable().optional(),
  regularMarketPreviousClose: z.number().nullable().optional(),
  marketCap: z.number().nullable().optional(),
  updatedAt: z.string().optional(),
})

export const brapiQuoteResponseSchema = z.object({
  results: z.array(brapiQuoteResultSchema),
  requestedAt: z.string().optional(),
})

export type BrapiQuoteResult = z.infer<typeof brapiQuoteResultSchema>
export type BrapiQuoteResponse = z.infer<typeof brapiQuoteResponseSchema>

// ----------------------------------------------------------------
// Resposta da brapi.dev — histórico (historicalDataPrice)
// ----------------------------------------------------------------

export const brapiCandleSchema = z.object({
  date: z.number(),
  open: z.number().nullable(),
  high: z.number().nullable(),
  low: z.number().nullable(),
  close: z.number().nullable(),
  volume: z.number().nullable(),
  adjustedClose: z.number().nullable().optional(),
}).passthrough()

export const brapiHistoryResultSchema = z.object({
  symbol: z.string(),
  historicalDataPrice: z.array(brapiCandleSchema).default([]),
}).passthrough()

export const brapiHistoryResponseSchema = z.object({
  results: z.array(brapiHistoryResultSchema),
  requestedAt: z.string().optional(),
})

export type BrapiCandle = z.infer<typeof brapiCandleSchema>
export type BrapiHistoryResult = z.infer<typeof brapiHistoryResultSchema>
export type BrapiHistoryResponse = z.infer<typeof brapiHistoryResponseSchema>

// ----------------------------------------------------------------
// Listagem de ativos — GET /quote/list
// ----------------------------------------------------------------

export const stockListQuerySchema = z.object({
  type: z
    .enum(['stock', 'fund', 'bdr'])
    .optional()
    .describe('Tipo do ativo: stock (ações), fund (FIIs), bdr'),
  search: z
    .string()
    .optional()
    .describe('Busca parcial por ticker (ex: "PETR" encontra PETR3, PETR4)'),
  sector: z
    .string()
    .optional()
    .describe('Filtro por setor (ex: Finance, Energy Minerals)'),
  sortBy: z
    .enum(['name', 'close', 'change', 'change_abs', 'volume', 'market_cap_basic', 'sector'])
    .optional()
    .describe('Campo de ordenação'),
  sortOrder: z
    .enum(['asc', 'desc'])
    .optional()
    .default('asc')
    .describe('Direção da ordenação'),
  limit: z
    .coerce.number().int().min(1).max(100)
    .optional()
    .default(10)
    .describe('Itens por página (máx 100)'),
  page: z
    .coerce.number().int().min(1)
    .optional()
    .default(1)
    .describe('Número da página'),
})

export type StockListQuery = z.infer<typeof stockListQuerySchema>

export const brapiListItemSchema = z.object({
  stock: z.string(),
  name: z.string(),
  close: z.number().nullable().optional(),
  change: z.number().nullable().optional(),
  volume: z.number().nullable().optional(),
  market_cap: z.number().nullable().optional(),
  logo: z.string().nullable().optional(),
  sector: z.string().nullable().optional(),
  type: z.string().optional(),
  priceToBook: z.number().nullable().optional().describe('P/VP — enriquecido via defaultKeyStatistics'),
}).passthrough() // preserva campos extras retornados pela brapi.dev

// ----------------------------------------------------------------
// Schema de enriquecimento P/VP — GET /quote/{tickers}?modules=defaultKeyStatistics
// ----------------------------------------------------------------

export const pvpItemSchema = z.object({
  symbol: z.string(),
  // P/VP pode vir no root (ex: via fundamental=true) ou dentro do módulo
  priceToBook: z.number().nullable().optional(),
  defaultKeyStatistics: z
    .object({
      priceToBook: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
}).passthrough()

export const pvpEnrichmentResponseSchema = z.object({
  results: z.array(pvpItemSchema),
}).passthrough()

export type PvpItem = z.infer<typeof pvpItemSchema>

export const brapiListResponseSchema = z.object({
  stocks: z.array(brapiListItemSchema).default([]),
  availableSectors: z.array(z.string()).optional(),
  availableStockTypes: z.array(z.string()).optional(),
  currentPage: z.number().optional(),
  totalPages: z.number().optional(),
  itemsPerPage: z.number().optional(),
  totalCount: z.number().optional(),
  hasNextPage: z.boolean().optional(),
})

export type BrapiListItem = z.infer<typeof brapiListItemSchema>
export type BrapiListResponse = z.infer<typeof brapiListResponseSchema>
