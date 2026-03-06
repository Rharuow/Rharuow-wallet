import { z } from 'zod'

export const STOCK_SORT_FIELDS = [
  'name',
  'close',
  'change',
  'change_abs',
  'volume',
  'market_cap_basic',
] as const

export type StockSortField = (typeof STOCK_SORT_FIELDS)[number]

export const StockListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(12),
  sortBy: z.enum(STOCK_SORT_FIELDS).default('market_cap_basic'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  sector: z.string().optional(),
})

export type StockListQuery = z.infer<typeof StockListQuerySchema>

export const StockItemSchema = z.object({
  stock: z.string(),
  name: z.string(),
  close: z.number(),
  change: z.number(),
  volume: z.number(),
  market_cap: z.number().nullable(),
  sector: z.string().nullable(),
  type: z.string(),
  logo: z.string(),
})

export type StockItem = z.infer<typeof StockItemSchema>

export const StockListResponseSchema = z.object({
  stocks: z.array(StockItemSchema),
  availableSectors: z.array(z.string()),
  currentPage: z.number(),
  totalPages: z.number(),
  itemsPerPage: z.number(),
  totalCount: z.number(),
  hasNextPage: z.boolean(),
})

export type StockListResponse = z.infer<typeof StockListResponseSchema>

// ----------------------------------------------------------------
// Detalhe de uma ação
// ----------------------------------------------------------------

export const StockDetailSchema = z.object({
  symbol: z.string(),
  shortName: z.string().nullable(),
  longName: z.string().nullable(),
  currency: z.string().nullable(),
  logourl: z.string().nullable(),
  // Cotação
  regularMarketPrice: z.number().nullable(),
  regularMarketDayHigh: z.number().nullable(),
  regularMarketDayLow: z.number().nullable(),
  regularMarketChange: z.number().nullable(),
  regularMarketChangePercent: z.number().nullable(),
  regularMarketOpen: z.number().nullable(),
  regularMarketPreviousClose: z.number().nullable(),
  regularMarketVolume: z.number().nullable(),
  marketCap: z.number().nullable(),
  fiftyTwoWeekHigh: z.number().nullable(),
  fiftyTwoWeekLow: z.number().nullable(),
  priceEarnings: z.number().nullable(),
  earningsPerShare: z.number().nullable(),
  // Perfil
  summaryProfile: z.object({
    sector: z.string().nullable(),
    industry: z.string().nullable(),
    website: z.string().nullable(),
    longBusinessSummary: z.string().nullable(),
    fullTimeEmployees: z.number().nullable(),
    cnpj: z.string().nullable(),
  }).nullable(),
  // Financeiro
  financialData: z.object({
    totalRevenue: z.number().nullable(),
    grossProfits: z.number().nullable(),
    ebitda: z.number().nullable(),
    totalDebt: z.number().nullable(),
    totalCash: z.number().nullable(),
    freeCashflow: z.number().nullable(),
    operatingCashflow: z.number().nullable(),
    grossMargins: z.number().nullable(),
    operatingMargins: z.number().nullable(),
    profitMargins: z.number().nullable(),
    returnOnAssets: z.number().nullable(),
    returnOnEquity: z.number().nullable(),
    debtToEquity: z.number().nullable(),
    currentRatio: z.number().nullable(),
    quickRatio: z.number().nullable(),
    revenueGrowth: z.number().nullable(),
    earningsGrowth: z.number().nullable(),
  }).nullable(),
  // Estatísticas
  defaultKeyStatistics: z.object({
    enterpriseValue: z.number().nullable(),
    bookValue: z.number().nullable(),
    priceToBook: z.number().nullable(),
    sharesOutstanding: z.number().nullable(),
    netIncomeToCommon: z.number().nullable(),
    trailingEps: z.number().nullable(),
    pegRatio: z.number().nullable(),
    enterpriseToRevenue: z.number().nullable(),
    enterpriseToEbitda: z.number().nullable(),
    beta: z.number().nullable(),
  }).nullable(),
})

export type StockDetail = z.infer<typeof StockDetailSchema>
