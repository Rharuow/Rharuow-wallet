import { redis } from '../../lib/redis'

const AWESOME_BASE = 'https://economia.awesomeapi.com.br'
const BRAPI_BASE = 'https://brapi.dev/api'
const DAYS = 365
const CACHE_KEY = 'market:overview'
const CACHE_TTL = 1800 // 30 min

export type HistoryPoint = { date: string; value: number }

export type MarketAsset = {
  code: string
  name: string
  symbol: string
  value: number
  change: number
  history: HistoryPoint[]
}

type AwesomeDay = {
  bid: string
  pctChange: string
  timestamp: string
}

async function fetchAwesome(
  pair: string,
  code: string,
  name: string,
  symbol: string,
): Promise<MarketAsset> {
  const res = await fetch(`${AWESOME_BASE}/json/daily/${pair}/${DAYS}`)
  if (!res.ok) throw new Error(`AwesomeAPI ${pair} failed: ${res.status}`)
  const data: AwesomeDay[] = await res.json()
  const history = [...data].reverse().map((d) => ({
    date: new Date(Number(d.timestamp) * 1000).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }),
    value: parseFloat(d.bid),
  }))
  return {
    code,
    name,
    symbol,
    value: parseFloat(data[0].bid),
    change: parseFloat(data[0].pctChange),
    history,
  }
}

async function fetchIbov(): Promise<MarketAsset> {
  const token = process.env.BRAPI_TOKEN
  const url = new URL(`${BRAPI_BASE}/quote/%5EBVSP`)
  url.searchParams.set('range', '1y')
  url.searchParams.set('interval', '1d')
  if (token) url.searchParams.set('token', token)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`BRAPI IBOV failed: ${res.status}`)
  const data = await res.json()
  const result = data.results?.[0]
  if (!result) throw new Error('BRAPI no result')

  const history: HistoryPoint[] = (
    (result.historicalDataPrice ?? []) as { date: number; close: number }[]
  )
    .sort((a, b) => a.date - b.date)
    .map((d) => ({
      date: new Date(d.date * 1000).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }),
      value: d.close,
    }))

  return {
    code: 'IBOV',
    name: 'Ibovespa',
    symbol: 'B3',
    value: result.regularMarketPrice,
    change: result.regularMarketChangePercent,
    history,
  }
}

export async function fetchMarketOverview(): Promise<MarketAsset[]> {
  const cached = await redis.get<MarketAsset[]>(CACHE_KEY)
  if (cached) return cached

  const results = await Promise.allSettled([
    fetchAwesome('USD-BRL', 'USD', 'Dólar', '$'),
    fetchAwesome('EUR-BRL', 'EUR', 'Euro', '€'),
    fetchAwesome('BTC-BRL', 'BTC', 'Bitcoin', '₿'),
    fetchIbov(),
  ])

  const assets = results
    .filter(
      (r): r is PromiseFulfilledResult<MarketAsset> => r.status === 'fulfilled',
    )
    .map((r) => r.value)

  if (assets.length > 0) {
    await redis.set(CACHE_KEY, assets, { ex: CACHE_TTL })
  }

  return assets
}
