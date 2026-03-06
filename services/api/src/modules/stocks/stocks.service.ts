import { redis } from '../../lib/redis'
import { fetchBrapiStocks, fetchBrapiStockDetail } from '../../lib/brapiStocksClient'
import type { StockListQuery, StockListResponse, StockDetail } from './stocks.schema'
import { StockDetailSchema } from './stocks.schema'

/**
 * Gera uma chave de cache única por conjunto de parâmetros.
 * TTL curto (60 s) para manter dados razoavelmente frescos sem sobrecarregar a brapi.
 */
function buildCacheKey(query: StockListQuery): string {
  const { page, limit, sortBy, sortOrder, search, sector } = query
  return [
    'brapi:stocks',
    `p${page}`,
    `l${limit}`,
    `s${sortBy}`,
    `o${sortOrder}`,
    search ? `q${search}` : '',
    sector ? `sec${sector}` : '',
  ]
    .filter(Boolean)
    .join(':')
}

export async function listStocks(query: StockListQuery): Promise<StockListResponse> {
  const cacheKey = buildCacheKey(query)

  const cached = await redis.get<StockListResponse>(cacheKey)
  if (cached) return cached

  const data = await fetchBrapiStocks({
    type: 'stock',
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    search: query.search,
    sector: query.sector,
  })

  // Cache por 60 s — brapi atualiza cotações em tempo real
  await redis.set(cacheKey, data, { ex: 60 })

  return data
}

export async function getStockDetail(ticker: string): Promise<StockDetail | null> {
  const upperTicker = ticker.toUpperCase()
  const cacheKey = `brapi:stock:detail:${upperTicker}`

  const cached = await redis.get<StockDetail>(cacheKey)
  if (cached) return cached

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await fetchBrapiStockDetail(ticker)

  let detail: StockDetail

  if (raw) {
    // Valida e normaliza com Zod (safeParse para não quebrar em campos inesperados)
    const parsed = StockDetailSchema.safeParse(raw)
    detail = parsed.success ? parsed.data : (raw as StockDetail)
  } else {
    // Fallback: busca dados básicos via endpoint de listagem (não requer token)
    const listData = await fetchBrapiStocks({ type: 'stock', search: upperTicker, limit: 1 })
    const match = listData.stocks.find(
      (s) => s.stock.toUpperCase() === upperTicker,
    )
    if (!match) return null

    detail = {
      symbol: match.stock,
      shortName: match.name,
      longName: match.name,
      currency: 'BRL',
      logourl: match.logo ?? null,
      regularMarketPrice: match.close ?? null,
      regularMarketDayHigh: null,
      regularMarketDayLow: null,
      regularMarketChange: null,
      regularMarketChangePercent: match.change ?? null,
      regularMarketOpen: null,
      regularMarketPreviousClose: null,
      regularMarketVolume: match.volume ?? null,
      marketCap: match.market_cap ?? null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      priceEarnings: null,
      earningsPerShare: null,
      summaryProfile: {
        sector: match.sector ?? null,
        industry: null,
        website: null,
        longBusinessSummary: null,
        fullTimeEmployees: null,
        cnpj: null,
      },
      financialData: null,
      defaultKeyStatistics: null,
    }
  }

  await redis.set(cacheKey, detail, { ex: 60 })

  return detail
}
