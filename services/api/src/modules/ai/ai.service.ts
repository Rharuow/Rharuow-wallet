import OpenAI from 'openai'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'
import { getStockDetail } from '../stocks/stocks.service'
import type { StockDetail } from '../stocks/stocks.schema'
import { getFii } from '../fiis/fiis.service'
import type { FiiItem } from '../fiis/fiis.schema'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Cache TTL: 1 hora (insights do mesmo período não mudam)
const CACHE_TTL_SECONDS = 60 * 60

// Rate limit: máximo de requisições por janela por usuário
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60 // 1 hora

async function checkRateLimit(userId: string): Promise<void> {
  const key = `ai:rate:${userId}`
  const current = await redis.get<number>(key)
  if (current !== null && current >= RATE_LIMIT_MAX) {
    throw Object.assign(
      new Error(`Limite de ${RATE_LIMIT_MAX} insights por hora atingido. Tente novamente mais tarde.`),
      { statusCode: 429 },
    )
  }
  // Incrementa — se não existia, cria com TTL
  if (current === null) {
    await redis.set(key, 1, { ex: RATE_LIMIT_WINDOW_SECONDS })
  } else {
    await redis.set(key, current + 1, { ex: RATE_LIMIT_WINDOW_SECONDS })
  }
}

function buildCacheKey(userId: string, request: InsightsRequest): string {
  return `ai:insights:${userId}:${request.type}:${request.period.dateFrom}:${request.period.dateTo}`
}

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

interface ByMonth { month: string; total: number }
interface ByArea  { areaId: string; areaName: string; total: number }
interface ByType  { typeId?: string; typeName?: string; areaName?: string; type?: string; label?: string; total: number; count: number }
interface Summary { total: number; count: number; average: number }

export interface CostAnalyticsInput {
  summary: Summary
  byMonth: ByMonth[]
  byArea: ByArea[]
  byType: ByType[]
}

export interface IncomeAnalyticsInput {
  summary: Summary
  byMonth: ByMonth[]
  byType: ByType[]
}

export interface InsightsRequest {
  type: 'costs' | 'incomes'
  period: { dateFrom: string; dateTo: string }
  analytics: CostAnalyticsInput | IncomeAnalyticsInput
  costTotal?: number   // only for incomes: total cost in same period
}

// ----------------------------------------------------------------
// Plan check
// ----------------------------------------------------------------

export async function userIsPremium(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: { select: { name: true } } },
  })
  return user?.plan?.name === 'PREMIUM'
}

// ----------------------------------------------------------------
// Prompt builders
// ----------------------------------------------------------------

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatMonth(ym: string) {
  const [year, month] = ym.split('-')
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${names[parseInt(month, 10) - 1]}/${year.slice(2)}`
}

function buildCostPrompt(period: { dateFrom: string; dateTo: string }, data: CostAnalyticsInput): string {
  const byMonthText = data.byMonth.length
    ? data.byMonth.map(m => `  - ${formatMonth(m.month)}: ${formatBRL(m.total)}`).join('\n')
    : '  Sem dados mensais.'

  const byAreaText = (data as CostAnalyticsInput).byArea?.length
    ? (data as CostAnalyticsInput).byArea.map(a => `  - ${a.areaName}: ${formatBRL(a.total)}`).join('\n')
    : '  Sem dados por área.'

  const byTypeText = (data as CostAnalyticsInput).byType?.length
    ? (data as CostAnalyticsInput).byType
        .slice(0, 10)
        .map(t => `  - ${t.typeName ?? t.label ?? 'Tipo'} (${t.areaName ?? ''}): ${formatBRL(t.total)} (${t.count} lançamentos)`)
        .join('\n')
    : '  Sem dados por tipo.'

  return `Você é um assistente financeiro pessoal especializado em finanças domésticas brasileiras.

Analise os seguintes dados de CUSTOS do período de ${period.dateFrom} a ${period.dateTo}:

RESUMO:
- Total de custos: ${formatBRL(data.summary.total)}
- Número de lançamentos: ${data.summary.count}
- Custo médio por lançamento: ${formatBRL(data.summary.average)}

EVOLUÇÃO MENSAL:
${byMonthText}

POR ÁREA DE CUSTO:
${byAreaText}

POR TIPO DE CUSTO (top 10):
${byTypeText}

Forneça exatamente 4 insights práticos e personalizados em português do Brasil. Cada insight deve:
1. Ser baseado nos dados acima
2. Ser objetivo e acionável
3. Destacar padrões, tendências ou oportunidades de economia

Responda APENAS com uma lista de 4 bullets, começando cada um com "•". Sem introdução, sem conclusão, apenas os 4 bullets.`
}

function buildIncomePrompt(
  period: { dateFrom: string; dateTo: string },
  data: IncomeAnalyticsInput,
  costTotal?: number,
): string {
  const net = costTotal !== undefined ? data.summary.total - costTotal : null
  const byMonthText = data.byMonth.length
    ? data.byMonth.map(m => `  - ${formatMonth(m.month)}: ${formatBRL(m.total)}`).join('\n')
    : '  Sem dados mensais.'

  const byTypeText = data.byType?.length
    ? data.byType.map(t => `  - ${t.label ?? t.type}: ${formatBRL(t.total)} (${t.count} lançamentos)`).join('\n')
    : '  Sem dados por tipo.'

  const netLine = net !== null
    ? `- Saldo líquido (entradas - custos): ${formatBRL(net)} (${net >= 0 ? 'positivo ✅' : 'negativo ⚠️'})`
    : ''

  return `Você é um assistente financeiro pessoal especializado em finanças domésticas brasileiras.

Analise os seguintes dados de ENTRADAS (RECEITAS) do período de ${period.dateFrom} a ${period.dateTo}:

RESUMO:
- Total de entradas: ${formatBRL(data.summary.total)}
${net !== null ? `- Total de custos no período: ${formatBRL(costTotal!)}` : ''}
${netLine}
- Número de entradas: ${data.summary.count}
- Valor médio por entrada: ${formatBRL(data.summary.average)}

EVOLUÇÃO MENSAL:
${byMonthText}

POR TIPO DE ENTRADA:
${byTypeText}

Forneça exatamente 4 insights práticos e personalizados em português do Brasil. Cada insight deve:
1. Ser baseado nos dados acima
2. Ser objetivo e acionável
3. Destacar padrões, diversificação de renda, saúde financeira ou oportunidades

Responda APENAS com uma lista de 4 bullets, começando cada um com "•". Sem introdução, sem conclusão, apenas os 4 bullets.`
}

// ----------------------------------------------------------------
// Main function
// ----------------------------------------------------------------

export async function generateInsights(userId: string, request: InsightsRequest): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error('Serviço de IA não configurado.'), { statusCode: 503 })
  }

  // 1. Cache hit?
  const cacheKey = buildCacheKey(userId, request)
  const cached = await redis.get<string>(cacheKey)
  if (cached) return cached

  // 2. Rate limit
  await checkRateLimit(userId)

  // 3. Chamada à OpenAI
  const prompt = request.type === 'costs'
    ? buildCostPrompt(request.period, request.analytics as CostAnalyticsInput)
    : buildIncomePrompt(request.period, request.analytics as IncomeAnalyticsInput, request.costTotal)

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  })

  const result = completion.choices[0]?.message?.content?.trim() ?? 'Não foi possível gerar insights.'

  // 4. Persiste no cache
  await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS })

  return result
}

// ─────────────────────────────────────────────────────────────────
// Stock Analysis (Análise de Ativo — Stocks)
// ─────────────────────────────────────────────────────────────────

function fPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(2)}%`
}

function fNum(v: number | null | undefined, d = 2): string {
  if (v == null) return '—'
  return v.toFixed(d)
}

function fCompact(v: number | null | undefined): string {
  if (v == null) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e12) return `R$ ${(v / 1e12).toFixed(2)} tri`
  if (abs >= 1e9)  return `R$ ${(v / 1e9).toFixed(2)} bi`
  if (abs >= 1e6)  return `R$ ${(v / 1e6).toFixed(2)} mi`
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildStockAnalysisPrompt(ticker: string, stock: StockDetail): string {
  const fd = stock.financialData
  const ks = stock.defaultKeyStatistics
  const sp = stock.summaryProfile

  const sectorLine = [sp?.sector, sp?.industry].filter(Boolean).join(' / ') || '—'

  return `Você é um analista de investimentos especializado no mercado de renda variável brasileiro (B3).

Analise o ativo ${ticker.toUpperCase()} — ${stock.longName ?? stock.shortName ?? ticker} — com base nos dados fundamentalistas abaixo e forneça uma opinião contextualizada para um investidor de longo prazo.

DADOS DE MERCADO:
- Cotação atual: ${stock.regularMarketPrice != null ? formatBRL(stock.regularMarketPrice) : '—'}
- Variação no dia: ${stock.regularMarketChangePercent != null ? `${stock.regularMarketChangePercent >= 0 ? '+' : ''}${stock.regularMarketChangePercent.toFixed(2)}%` : '—'}
- Market Cap: ${fCompact(stock.marketCap)}
- Setor / Indústria: ${sectorLine}
- Mín 52 sem: ${stock.fiftyTwoWeekLow != null ? formatBRL(stock.fiftyTwoWeekLow) : '—'} | Máx 52 sem: ${stock.fiftyTwoWeekHigh != null ? formatBRL(stock.fiftyTwoWeekHigh) : '—'}

VALUATION:
- P/L: ${fNum(stock.priceEarnings)} | P/VP: ${fNum(ks?.priceToBook)} | PEG Ratio: ${fNum(ks?.pegRatio)}
- EV/EBITDA: ${fNum(ks?.enterpriseToEbitda)} | EV/Receita: ${fNum(ks?.enterpriseToRevenue)}
- Enterprise Value: ${fCompact(ks?.enterpriseValue)} | Beta: ${fNum(ks?.beta)}

RESULTADOS (últimos 12 meses):
- Receita: ${fCompact(fd?.totalRevenue)} | Lucro Bruto: ${fCompact(fd?.grossProfits)}
- EBITDA: ${fCompact(fd?.ebitda)} | Lucro Líquido: ${fCompact(ks?.netIncomeToCommon)}
- Fluxo de Caixa Livre: ${fCompact(fd?.freeCashflow)} | FC Operacional: ${fCompact(fd?.operatingCashflow)}
- Crescimento da Receita: ${fPct(fd?.revenueGrowth)} | Crescimento do Lucro: ${fPct(fd?.earningsGrowth)}

MARGENS E RETORNOS:
- Margem Bruta: ${fPct(fd?.grossMargins)} | Margem EBIT: ${fPct(fd?.operatingMargins)} | Margem Líquida: ${fPct(fd?.profitMargins)}
- ROE: ${fPct(fd?.returnOnEquity)} | ROA: ${fPct(fd?.returnOnAssets)}

ENDIVIDAMENTO E LIQUIDEZ:
- Dívida Total: ${fCompact(fd?.totalDebt)} | Caixa: ${fCompact(fd?.totalCash)}
- Dív./PL: ${fNum(fd?.debtToEquity)} | Liquidez Corrente: ${fNum(fd?.currentRatio)} | Liquidez Seca: ${fNum(fd?.quickRatio)}

Forneça exatamente 5 pontos de análise em português do Brasil, cobrindo:
1. Precificação e valuation
2. Qualidade dos resultados e crescimento
3. Margens e capacidade de geração de retorno
4. Saúde financeira e endividamento
5. Conclusão geral com contexto de risco e oportunidade

Responda APENAS com uma lista de 5 bullets, começando cada um com "•". Sem introdução, sem conclusão adicional, apenas os 5 bullets.`
}

export async function analyzeStock(userId: string, ticker: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error('Serviço de IA não configurado.'), { statusCode: 503 })
  }

  const upperTicker = ticker.toUpperCase()
  const cacheKey = `ai:stock-analysis:${userId}:${upperTicker}`

  const cached = await redis.get<string>(cacheKey)
  if (cached) return cached

  await checkRateLimit(userId)

  const stock = await getStockDetail(upperTicker)
  if (!stock) {
    throw Object.assign(new Error(`Ativo "${upperTicker}" não encontrado.`), { statusCode: 404 })
  }

  const prompt = buildStockAnalysisPrompt(upperTicker, stock)

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600,
    temperature: 0.7,
  })

  const result = completion.choices[0]?.message?.content?.trim() ?? 'Não foi possível gerar a análise.'
  await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS })
  return result
}

// ─────────────────────────────────────────────────────────────────
// FII Analysis (Análise de Ativo — FIIs)
// ─────────────────────────────────────────────────────────────────

function buildFiiAnalysisPrompt(papel: string, fii: FiiItem): string {
  const pct = (v: number | null) => (v == null ? '—' : `${v.toFixed(2)}%`)
  const brl = (v: number | null) => (v == null ? '—' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  const compact = (v: number | null) => {
    if (v == null) return '—'
    if (Math.abs(v) >= 1e9)  return `R$ ${(v / 1e9).toFixed(2)} bi`
    if (Math.abs(v) >= 1e6)  return `R$ ${(v / 1e6).toFixed(2)} mi`
    return brl(v)
  }

  return `Você é um analista especializado em Fundos de Investimento Imobiliário (FIIs) no mercado brasileiro (B3).

Analise o FII ${papel.toUpperCase()} — Segmento: ${fii.segmento || '—'} — com base nos dados fundamentalistas abaixo e forneça uma opinião contextualizada para um investidor de longo prazo.

DADOS DE MERCADO:
- Cotação atual: ${brl(fii.cotacao)}
- Valor de Mercado: ${compact(fii.valorMercado)}
- Liquidez Diária: ${compact(fii.liquidez)}

INDICADORES DE RENDIMENTO:
- Dividend Yield (DY): ${pct(fii.dividendYield)}
- FFO Yield: ${pct(fii.ffoYield)}

VALUATION:
- P/VP (Preço/Valor Patrimonial): ${fii.pvp != null ? fii.pvp.toFixed(2) : '—'}

DADOS DO PORTFÓLIO IMOBILIÁRIO:
- Quantidade de imóveis: ${fii.qtdImoveis ?? '—'}
- Preço por m²: ${brl(fii.precoM2)}
- Aluguel por m²: ${brl(fii.aluguelM2)}
- Cap Rate: ${pct(fii.capRate)}
- Vacância média: ${pct(fii.vacanciaMedia)}

Forneça exatamente 5 pontos de análise em português do Brasil, cobrindo:
1. Avaliação do rendimento (DY e FFO Yield) em contexto de mercado
2. Precificação — análise do P/VP e se o fundo negocia com prêmio ou desconto
3. Qualidade do portfólio imobiliário (Cap Rate, preço/aluguel por m², vacância)
4. Liquidez e tamanho do fundo
5. Conclusão geral com contexto de risco e oportunidade para o segmento ${fii.segmento || 'deste fundo'}

Responda APENAS com uma lista de 5 bullets, começando cada um com "•". Sem introdução, sem conclusão adicional, apenas os 5 bullets.`
}

export async function analyzeFii(userId: string, papel: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error('Serviço de IA não configurado.'), { statusCode: 503 })
  }

  const upperPapel = papel.toUpperCase()
  const cacheKey = `ai:fii-analysis:${userId}:${upperPapel}`

  const cached = await redis.get<string>(cacheKey)
  if (cached) return cached

  await checkRateLimit(userId)

  const fii = await getFii(upperPapel)
  if (!fii) {
    throw Object.assign(new Error(`FII "${upperPapel}" não encontrado.`), { statusCode: 404 })
  }

  const prompt = buildFiiAnalysisPrompt(upperPapel, fii)

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600,
    temperature: 0.7,
  })

  const result = completion.choices[0]?.message?.content?.trim() ?? 'Não foi possível gerar a análise.'
  await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS })
  return result
}
