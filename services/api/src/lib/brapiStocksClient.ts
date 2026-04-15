/**
 * brapiStocksClient
 *
 * Consome a API pública brapi.dev para listar ações da B3.
 * Ordenação, filtros e paginação são delegados à própria API.
 *
 * Endpoint: GET https://brapi.dev/api/quote/list
 *
 * Params suportados:
 *  - type        → "stock" | "fund" | "bdr"  (default: stock)
 *  - sortBy      → name | close | change | change_abs | volume | market_cap_basic
 *  - sortOrder   → asc | desc
 *  - limit       → itens por página (máx 100)
 *  - page        → número da página
 *  - search      → busca parcial pelo ticker
 *  - sector      → filtro por setor
 */

export const BRAPI_QUOTE_LIST_URL = 'https://brapi.dev/api/quote/list'

export interface BrapiStock {
  stock: string
  name: string
  close: number
  change: number
  volume: number
  market_cap: number | null
  sector: string | null
  type: string
  logo: string
}

export interface BrapiStocksResponse {
  stocks: BrapiStock[]
  availableSectors: string[]
  availableStockTypes: string[]
  currentPage: number
  totalPages: number
  itemsPerPage: number
  totalCount: number
  hasNextPage: boolean
}

export interface BrapiStocksParams {
  type?: string
  sortBy?: string
  sortOrder?: string
  limit?: number
  page?: number
  search?: string
  sector?: string
  token?: string
}

export async function fetchBrapiStocks(
  params: BrapiStocksParams,
): Promise<BrapiStocksResponse> {
  const url = new URL(BRAPI_QUOTE_LIST_URL)

  url.searchParams.set('type', params.type ?? 'stock')
  if (params.sortBy) url.searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) url.searchParams.set('sortOrder', params.sortOrder)
  if (params.limit) url.searchParams.set('limit', String(params.limit))
  if (params.page) url.searchParams.set('page', String(params.page))
  if (params.search) url.searchParams.set('search', params.search)
  if (params.sector) url.searchParams.set('sector', params.sector)
  if (params.token) url.searchParams.set('token', params.token)

  const res = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json' },
    // Garante dados frescos em cada chamada do service
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`brapi error: ${res.status} ${res.statusText}`)
  }

  const json = (await res.json()) as BrapiStocksResponse & {
    success?: boolean
    error?: unknown
  }

  if ('success' in json && json.success === false) {
    throw new Error(`brapi validation error: ${JSON.stringify(json.error)}`)
  }

  return json
}

// ----------------------------------------------------------------
// Detalhe de uma ação
// ----------------------------------------------------------------

const BRAPI_QUOTE_URL = 'https://brapi.dev/api/quote'
const DETAIL_MODULES = [
  'summaryProfile',
  'financialData',
  'defaultKeyStatistics',
  'balanceSheetHistory',
  'incomeStatementHistory',
  'cashflowHistory',
].join(',')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchQuote(url: string): Promise<any | null> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  })

  if (!res.ok) return null

  const json = await res.json() as { results?: unknown[]; error?: unknown }

  if (!json.results || json.results.length === 0) return null

  return json.results[0]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchBrapiStockDetail(ticker: string): Promise<any> {
  const encoded = encodeURIComponent(ticker.toUpperCase())
  const token = process.env.BRAPI_TOKEN

  // Tenta com módulos completos (requer token pago no brapi.dev)
  const modulesUrl = `${BRAPI_QUOTE_URL}/${encoded}?modules=${DETAIL_MODULES}${
    token ? `&token=${token}` : ''
  }`
  const basicUrl = `${BRAPI_QUOTE_URL}/${encoded}${token ? `?token=${token}` : ''}`
  const [withModules, basic] = await Promise.all([
    fetchQuote(modulesUrl),
    fetchQuote(basicUrl),
  ])

  if (!withModules) {
    return basic
  }

  if (!basic) {
    return withModules
  }

  // Une dados básicos com módulos, preservando campos de cotação/dividendos que
  // por vezes não vêm no payload de módulos dependendo do plano da BRAPI.
  return {
    ...basic,
    ...withModules,
    summaryDetail: withModules.summaryDetail ?? basic.summaryDetail ?? null,
    defaultKeyStatistics: {
      ...(basic.defaultKeyStatistics ?? {}),
      ...(withModules.defaultKeyStatistics ?? {}),
    },
    financialData: {
      ...(basic.financialData ?? {}),
      ...(withModules.financialData ?? {}),
    },
  }
}
