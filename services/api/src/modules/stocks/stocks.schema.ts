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
