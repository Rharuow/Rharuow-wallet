import { redis } from '../../lib/redis'
import { fetchBrapiStocks } from '../../lib/brapiStocksClient'
import type { StockListQuery, StockListResponse } from './stocks.schema'

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
