import { redis } from '../../lib/redis'
import { b3Fetch } from '../../lib/b3Client'
import {
  brapiQuoteResponseSchema,
  brapiHistoryResponseSchema,
  brapiListResponseSchema,
  pvpEnrichmentResponseSchema,
  type BrapiQuoteResult,
  type BrapiHistoryResult,
  type BrapiListResponse,
  type StockHistoryQuery,
  type StockListQuery,
} from './stocks.schema'

// ----------------------------------------------------------------
// Helpers de TTL
// ----------------------------------------------------------------

/**
 * Verifica se o momento atual está dentro do pregão da B3.
 * Pregão: segunda a sexta, 10:00–17:55 (BRT = UTC-3).
 */
function isDuringTradingHours(): boolean {
  const now = new Date()
  // Converte para horário de Brasília (UTC-3)
  const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))

  const day = brt.getDay() // 0=Dom, 6=Sáb
  if (day === 0 || day === 6) return false

  const hours = brt.getHours()
  const minutes = brt.getMinutes()
  const totalMinutes = hours * 60 + minutes

  const open = 10 * 60       // 10:00
  const close = 17 * 60 + 55 // 17:55

  return totalMinutes >= open && totalMinutes <= close
}

/**
 * TTL em segundos para cotação atual.
 * - Durante o pregão: 2 minutos (dados mudam com frequência)
 * - Fora do pregão:  30 minutos (mercado fechado, dado estático)
 */
function quoteTtl(): number {
  return isDuringTradingHours() ? 2 * 60 : 30 * 60
}

/** TTL fixo de 1 hora para séries históricas. */
const HISTORY_TTL = 60 * 60

/** TTL fixo de 24 horas para metadados. */
const METADATA_TTL = 24 * 60 * 60

/** Número máximo de tickers por requisição de enriquecimento. */
const PVP_CHUNK_SIZE = 20

// ----------------------------------------------------------------
// Cache keys
// ----------------------------------------------------------------

const cacheKey = {
  quote: (symbol: string) => `b3:quote:${symbol.toUpperCase()}`,
  history: (symbol: string, range: string, interval: string) =>
    `b3:history:${symbol.toUpperCase()}:${range}:${interval}`,
  pvp: (symbol: string) => `b3:pvp:${symbol.toUpperCase()}`,
}

// ----------------------------------------------------------------
// Helper: enriquecimento P/VP em lote
// ----------------------------------------------------------------

/**
 * Para cada símbolo informado, tenta retornar o priceToBook (P/VP).
 * Fluxo por símbolo: Redis (METADATA_TTL=24h) → brapi.dev em chunks de PVP_CHUNK_SIZE.
 * Erros de enriquecimento são silenciados — a lista principal continua válida.
 */
async function fetchPriceToBook(symbols: string[]): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>()
  
  if (!symbols.length) return map

  // 1. Verifica cache individual por símbolo
  const missing: string[] = []
  for (const sym of symbols) {
    const cached = await redis.get<number>(cacheKey.pvp(sym))
    if (cached !== null && cached !== undefined) {
      map.set(sym, cached)
    } else {
      missing.push(sym)
    }
  }

  if (!missing.length) return map

  // 2. Busca em chunks os que não estão em cache
  for (let i = 0; i < missing.length; i += PVP_CHUNK_SIZE) {
    const chunk = missing.slice(i, i + PVP_CHUNK_SIZE)
    const tickers = chunk.map((s) => s.toUpperCase()).join(',')

    try {
      const raw = await b3Fetch<unknown>(`/quote/${tickers}`, {
        // fundamental=true: retorna priceToBook no root quando disponível
        // modules=defaultKeyStatistics: retorna priceToBook aninhado para ativos com esse dado
        params: { fundamental: 'true', modules: 'defaultKeyStatistics' },
      })

      const parsed = pvpEnrichmentResponseSchema.parse(raw)

      for (const item of parsed.results) {
        // Prioridade: módulo > root (fundamental)
        const pvp = item.defaultKeyStatistics?.priceToBook ?? item.priceToBook ?? null
        map.set(item.symbol.toUpperCase(), pvp)

        // Persiste somente valores numéricos válidos com TTL de 24h
        if (pvp !== null) {
          await redis.set(cacheKey.pvp(item.symbol), pvp, { ex: METADATA_TTL })
        }
      }
    } catch {
      // Enriquecimento falhou para este chunk — lista permanece válida sem P/VP
    }
  }

  return map
}

// ----------------------------------------------------------------
// Service: cotação atual
// ----------------------------------------------------------------

/**
 * Retorna a cotação atual de um ativo.
 * Fluxo: Redis → brapi.dev → salva no Redis → retorna.
 */
export async function getQuote(symbol: string): Promise<BrapiQuoteResult> {
  const key = cacheKey.quote(symbol)

  // 1. Tenta o cache
  const cached = await redis.get<BrapiQuoteResult>(key)
  if (cached) return cached

  // 2. Busca na API
  const raw = await b3Fetch<unknown>(`/quote/${symbol.toUpperCase()}`)
  const parsed = brapiQuoteResponseSchema.parse(raw)

  if (!parsed.results.length) {
    throw Object.assign(new Error(`Ativo "${symbol}" não encontrado na brapi.dev`), {
      statusCode: 404,
    })
  }

  const result = parsed.results[0]

  // 3. Persiste no Redis com TTL adequado
  await redis.set(key, result, { ex: quoteTtl() })

  return result
}

// ----------------------------------------------------------------
// Service: histórico de preços
// ----------------------------------------------------------------

/**
 * Retorna a série histórica OHLCV de um ativo.
 * Fluxo: Redis → brapi.dev → salva no Redis → retorna.
 */
export async function getHistory(
  symbol: string,
  query: StockHistoryQuery,
): Promise<BrapiHistoryResult> {
  const { range, interval } = query
  const key = cacheKey.history(symbol, range, interval)

  // 1. Tenta o cache
  const cached = await redis.get<BrapiHistoryResult>(key)
  if (cached) return cached

  // 2. Busca na API
  // A brapi.dev preenche historicalDataPrice automaticamente quando range e interval são fornecidos
  const raw = await b3Fetch<unknown>(`/quote/${symbol.toUpperCase()}`, {
    params: { range, interval },
  })

  const parsed = brapiHistoryResponseSchema.parse(raw)

  if (!parsed.results.length) {
    throw Object.assign(new Error(`Ativo "${symbol}" não encontrado na brapi.dev`), {
      statusCode: 404,
    })
  }

  const result = parsed.results[0]

  const ttl = range === '1d' ? quoteTtl() : HISTORY_TTL
  await redis.set(key, result, { ex: ttl })

  return result
}

// ----------------------------------------------------------------
// Service: metadados do ativo (nome, setor, tipo)
// ----------------------------------------------------------------

/**
 * Retorna metadados fundamentalistas de um ativo.
 * Fluxo: Redis → brapi.dev (fundamental=true) → salva no Redis → retorna.
 */
// ----------------------------------------------------------------
// Service: listagem de ativos
// ----------------------------------------------------------------

/**
 * Lista ativos da B3 com filtros, paginação e ordenação.
 * Cache key inclui todos os parâmetros para evitar colisões entre páginas/filtros.
 * TTL fixo de 5 minutos — lista muda pouco durante o pregão.
 */
export async function listStocks(query: StockListQuery): Promise<BrapiListResponse> {
  const { type, search, sector, sortBy, sortOrder, limit, page } = query

  // Monta cache key determinística com os parâmetros relevantes
  const keyParts = [
    'b3:list',
    type ?? 'all',
    search ?? '-',
    sector ?? '-',
    sortBy ?? '-',
    sortOrder,
    String(limit),
    String(page),
  ]
  const key = keyParts.join(':')

  // 1. Tenta o cache (inclui P/VP já enriquecido de requisições anteriores)
  // const cached = await redis.get<BrapiListResponse>(key)
  // if (cached) return cached

  // 2. Monta params para a brapi.dev
  const params: Record<string, string> = {
    limit: String(limit),
    page: String(page),
    sortOrder,
  }
  if (type) params.type = type
  if (search) params.search = search
  if (sector) params.sector = sector
  if (sortBy) params.sortBy = sortBy

  // 3. Busca lista na API
  const raw = await b3Fetch<unknown>('/quote/list', { params })
  const listResult = brapiListResponseSchema.parse(raw)

  // 4. Enriquece cada ativo com P/VP (cache individual por símbolo com TTL de 24h)
  const symbols = listResult.stocks.map((s) => s.stock)
  const pvpMap = await fetchPriceToBook(symbols)

  const enrichedStocks = listResult.stocks.map((s) => ({
    ...s,
    priceToBook: pvpMap.get(s.stock.toUpperCase()) ?? null,
  }))

  const result: BrapiListResponse = { ...listResult, stocks: enrichedStocks }

  // 5. Persiste lista enriquecida com quoteTtl():
  //    - Pregão ativo: 2 min (preços mudam com frequência)
  //    - Fora do pregão: 30 min (mercado fechado, dado estático)
  await redis.set(key, result, { ex: quoteTtl() })

  return result
}

export async function getAssetMetadata(symbol: string): Promise<BrapiQuoteResult> {
  const key = `b3:meta:${symbol.toUpperCase()}`

  const cached = await redis.get<BrapiQuoteResult>(key)
  if (cached) return cached

  const raw = await b3Fetch<unknown>(`/quote/${symbol.toUpperCase()}`, {
    params: { fundamental: 'true' },
  })

  const parsed = brapiQuoteResponseSchema.parse(raw)

  if (!parsed.results.length) {
    throw Object.assign(new Error(`Ativo "${symbol}" não encontrado na brapi.dev`), {
      statusCode: 404,
    })
  }

  const result = parsed.results[0]

  await redis.set(key, result, { ex: METADATA_TTL })

  return result
}
