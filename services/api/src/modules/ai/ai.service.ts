import OpenAI from 'openai'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'
import { isOpenAiMockEnabled } from '../../lib/openai-mode'
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

function buildMockInsights(request: InsightsRequest): string {
  if (request.type === 'costs') {
    const analytics = request.analytics as CostAnalyticsInput
    const topArea = analytics.byArea.slice().sort((left, right) => right.total - left.total)[0]
    const topType = analytics.byType.slice().sort((left, right) => right.total - left.total)[0]

    return [
      `• Seus custos no período somaram ${formatBRL(analytics.summary.total)}; trate esta resposta como mock de desenvolvimento para validar o fluxo sem consumir token.`,
      `• ${topArea ? `A área com maior peso foi ${topArea.areaName} (${formatBRL(topArea.total)}), então vale revisar recorrências e excessos nela primeiro.` : 'Ainda não há área dominante suficiente para inferência mais forte.'}`,
      `• ${topType ? `O tipo de custo com maior impacto foi ${topType.typeName ?? topType.label ?? 'não categorizado'} com ${formatBRL(topType.total)}.` : 'Os tipos de custo ainda não têm volume suficiente para um destaque confiável.'}`,
      '• Em produção, esta seção volta a usar a OpenAI; em dev, o objetivo aqui é manter a UI e os contratos exercitados com uma resposta estável.',
    ].join('\n')
  }

  const analytics = request.analytics as IncomeAnalyticsInput
  const topType = analytics.byType.slice().sort((left, right) => right.total - left.total)[0]
  const net = typeof request.costTotal === 'number' ? analytics.summary.total - request.costTotal : null

  return [
    `• Suas entradas no período somaram ${formatBRL(analytics.summary.total)}; esta é uma resposta mockada para ambiente de desenvolvimento.`,
    `• ${net === null ? 'O saldo líquido não foi calculado porque o total de custos não veio no payload.' : `O saldo líquido estimado no período foi de ${formatBRL(net)}.`}`,
    `• ${topType ? `A principal fonte de entrada foi ${topType.label ?? topType.type ?? 'não identificada'} com ${formatBRL(topType.total)}.` : 'Ainda não há fonte de renda dominante suficiente para destaque.'}`,
    '• Use esta saída para validar layout, cache e tratamento de estado sem custo de API externa.',
  ].join('\n')
}

function buildMockStockAnalysis(ticker: string, stock: StockDetail): string {
  return [
    `• ${ticker} está em modo mock de desenvolvimento; a cotação usada como referência é ${stock.regularMarketPrice != null ? formatBRL(stock.regularMarketPrice) : 'indisponível'}.`,
    `• Valuation: P/L ${fNum(stock.priceEarnings)} e P/VP ${fNum(stock.defaultKeyStatistics?.priceToBook)} servem aqui apenas para exercitar o fluxo visual e o contrato da API.`,
    `• Resultados: receita ${fCompact(stock.financialData?.totalRevenue)} e EBITDA ${fCompact(stock.financialData?.ebitda)} mostram que os dados de mercado foram carregados corretamente.`,
    `• Riscos: dívida total ${fCompact(stock.financialData?.totalDebt)} e liquidez corrente ${fNum(stock.financialData?.currentRatio)} continuam disponíveis mesmo sem chamada real à OpenAI.`,
    '• Conclusão prática: use este retorno estável para testar telas, polling e cache; desligue o mock para obter narrativa analítica real.',
  ].join('\n')
}

function buildMockFiiAnalysis(papel: string, fii: FiiItem): string {
  return [
    `• ${papel} está usando análise mock em desenvolvimento; a cotação de referência é ${fii.cotacao != null ? `R$ ${fii.cotacao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'indisponível'}.`,
    `• Rendimento: DY ${fii.dividendYield != null ? `${fii.dividendYield.toFixed(2)}%` : '—'} e FFO Yield ${fii.ffoYield != null ? `${fii.ffoYield.toFixed(2)}%` : '—'} são exibidos para validar o conteúdo do card.`,
    `• Precificação: P/VP ${fii.pvp != null ? fii.pvp.toFixed(2) : '—'} e vacância ${fii.vacanciaMedia != null ? `${fii.vacanciaMedia.toFixed(2)}%` : '—'} continuam vindo da base local.`,
    `• Qualidade do portfólio: segmento ${fii.segmento || 'não informado'} e liquidez ${fii.liquidez != null ? `R$ ${fii.liquidez.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'} ajudam a manter a tela útil durante dev.`,
    '• Conclusão prática: esta resposta genérica economiza token e mantém o fluxo completo testável.',
  ].join('\n')
}

function buildMockBudgetGoals(input: BudgetGoalsInput): string {
  const periodMonths = (() => {
    const from = new Date(input.period.dateFrom)
    const to = new Date(input.period.dateTo)
    const diff = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
    return Math.max(1, diff)
  })()

  const areaLines = input.byArea
    .slice()
    .sort((left, right) => right.total - left.total)
    .map((area) => {
      const monthlyAverage = area.total / periodMonths
      const target = monthlyAverage * 0.95
      return `• ${area.areaName}: meta ${formatBRL(target)}/mês — mock de desenvolvimento baseado em redução leve sobre a média histórica de ${formatBRL(monthlyAverage)}.`
    })

  const savingsTarget = Math.max(0, (input.incomeTotal - input.summary.total) / periodMonths)
  areaLines.push(
    `• Meta de Poupança: ${formatBRL(savingsTarget)}/mês (${input.incomeTotal > 0 ? (((savingsTarget / (input.incomeTotal / periodMonths)) || 0) * 100).toFixed(1) : '0.0'}% da renda) — resposta mockada para validar o fluxo sem OpenAI.`,
  )

  return areaLines.join('\n')
}

function buildMockHealthScore(input: HealthScoreInput): string {
  const totalIncome = input.incomes.summary.total
  const totalCosts = input.costs.summary.total
  const savingRate = totalIncome > 0 ? ((totalIncome - totalCosts) / totalIncome) * 100 : 0
  const score = Math.min(10, Math.max(1, Math.round(5 + (savingRate >= 20 ? 2 : savingRate > 0 ? 1 : -1))))

  return [
    `SCORE: ${score}/10`,
    `• Taxa de poupança: mock calculado com base em ${savingRate.toFixed(1)}% no período analisado.`,
    '• Burn rate e runway: esta resposta é genérica e serve para testar a renderização do score e dos bullets.',
    '• Composição dos custos: use os gráficos e agregados reais da API como principal referência durante o desenvolvimento.',
    '• Diversificação da renda: o mock preserva o formato esperado para a UI sem chamar a OpenAI.',
    '• Recomendação prioritária: valide o fluxo funcional em dev com mock ligado e desligue-o apenas para checagens qualitativas finais.',
  ].join('\n')
}

function normalizeFreeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function extractAmountFromText(input: string) {
  const currencyMatch = input.match(/(?:r\$\s*)?([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:[\.,][0-9]{2})?)/i)
  if (!currencyMatch) {
    return null
  }

  const normalized = currencyMatch[1].includes(',')
    ? currencyMatch[1].replace(/\./g, '').replace(',', '.')
    : currencyMatch[1]

  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function buildMockCostSuggestion(input: CostSuggestionInput): CostSuggestionResult {
  const normalizedInput = normalizeFreeText(input.input)
  const matchedType = input.types.find((type) => normalizedInput.includes(normalizeFreeText(type.name)))
  const matchedArea = matchedType
    ? input.areas.find((area) => area.id === matchedType.areaId)
    : input.areas.find((area) => normalizedInput.includes(normalizeFreeText(area.name))) ?? input.areas[0]

  if (!matchedArea) {
    throw Object.assign(new Error('Nenhuma área disponível para sugerir em modo mock.'), { statusCode: 422 })
  }

  return {
    amount: Math.round((extractAmountFromText(input.input) ?? 1) * 100) / 100,
    areaId: matchedArea.id,
    areaName: matchedArea.name,
    costTypeId: matchedType?.id ?? null,
    costTypeName: matchedType?.name ?? 'Despesa geral',
    description: input.input.trim().slice(0, 120) || 'Lançamento sugerido por mock',
  }
}

// ----------------------------------------------------------------
// Main function
// ----------------------------------------------------------------

export async function generateInsights(userId: string, request: InsightsRequest): Promise<string> {
  if (!process.env.OPENAI_API_KEY && !isOpenAiMockEnabled()) {
    throw Object.assign(new Error('Serviço de IA não configurado.'), { statusCode: 503 })
  }

  // 1. Cache hit?
  const cacheKey = buildCacheKey(userId, request)
  const cached = await redis.get<string>(cacheKey)
  if (cached) return cached

  // 2. Rate limit
  await checkRateLimit(userId)

  if (isOpenAiMockEnabled()) {
    const result = buildMockInsights(request)
    await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS })
    return result
  }

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
  if (!process.env.OPENAI_API_KEY && !isOpenAiMockEnabled()) {
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

  if (isOpenAiMockEnabled()) {
    const result = buildMockStockAnalysis(upperTicker, stock)
    await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS })
    return result
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
  if (!process.env.OPENAI_API_KEY && !isOpenAiMockEnabled()) {
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

  if (isOpenAiMockEnabled()) {
    const result = buildMockFiiAnalysis(upperPapel, fii)
    await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS })
    return result
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

// ─────────────────────────────────────────────────────────────────
// Budget Goals Suggestion
// ─────────────────────────────────────────────────────────────────

export interface BudgetGoalsInput {
  period: { dateFrom: string; dateTo: string }
  summary: { total: number; count: number; average: number }
  byArea: Array<{ areaId: string; areaName: string; total: number }>
  byMonth: Array<{ month: string; total: number }>
  incomeTotal: number
}

function buildBudgetGoalsPrompt(input: BudgetGoalsInput): string {
  const brl = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const periodMonths = (() => {
    const from = new Date(input.period.dateFrom)
    const to   = new Date(input.period.dateTo)
    const diff = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
    return Math.max(1, diff)
  })()

  const savingMargin = input.incomeTotal > 0
    ? `${(((input.incomeTotal - input.summary.total) / input.incomeTotal) * 100).toFixed(1)}%`
    : '—'

  const byAreaText = input.byArea.length
    ? input.byArea
        .sort((a, b) => b.total - a.total)
        .map((a) => {
          const monthly = a.total / periodMonths
          return `  - ${a.areaName}: ${brl(a.total)} total (≈ ${brl(monthly)}/mês)`
        })
        .join('\n')
    : '  Sem dados por área.'

  const byMonthText = input.byMonth.length
    ? input.byMonth
        .map((m) => {
          const [year, month] = m.month.split('-')
          const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
          return `  - ${names[parseInt(month, 10) - 1]}/${year.slice(2)}: ${brl(m.total)}`
        })
        .join('\n')
    : '  Sem dados mensais.'

  return `Você é um planejador financeiro pessoal especializado em finanças domésticas brasileiras.

Com base nos dados abaixo, sugira metas de orçamento mensais realistas e motivadoras para cada área de custo, levando em conta a renda disponível e as tendências de gasto.

PERÍODO ANALISADO: ${input.period.dateFrom} a ${input.period.dateTo} (${periodMonths} mês(es))

RESUMO FINANCEIRO:
- Renda total no período: ${brl(input.incomeTotal)}
- Total de custos no período: ${brl(input.summary.total)}
- Margem de poupança atual: ${savingMargin}
- Custo médio por lançamento: ${brl(input.summary.average)}

GASTOS POR ÁREA (total no período → média mensal):
${byAreaText}

EVOLUÇÃO MENSAL DOS GASTOS:
${byMonthText}

Forneça EXATAMENTE uma sugestão de meta por área de custo listada, mais UMA meta global de poupança, seguindo o formato abaixo para CADA bullet:
• [Nome da Área]: meta R$ X/mês — [justificativa curta de 1 linha: compare com o histórico e indique se é redução, manutenção ou crescimento controlado]

Último bullet obrigatório:
• Meta de Poupança: R$ X/mês ([Y]% da renda) — [justificativa curta]

Regras:
- Seja realista: não sugira cortes impossíveis
- Use os dados históricos como referência principal
- Responda APENAS com os bullets, sem introdução nem conclusão`
}

export async function suggestBudgetGoals(userId: string, input: BudgetGoalsInput): Promise<string> {
  if (!process.env.OPENAI_API_KEY && !isOpenAiMockEnabled()) {
    throw Object.assign(new Error('Serviço de IA não configurado.'), { statusCode: 503 })
  }

  const cacheKey = `ai:budget-goals:${userId}:${input.period.dateFrom}:${input.period.dateTo}`
  const cached = await redis.get<string>(cacheKey)
  if (cached) return cached

  await checkRateLimit(userId)

  if (isOpenAiMockEnabled()) {
    const result = buildMockBudgetGoals(input)
    await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS })
    return result
  }

  const prompt = buildBudgetGoalsPrompt(input)

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600,
    temperature: 0.7,
  })

  const result = completion.choices[0]?.message?.content?.trim() ?? 'Não foi possível gerar as sugestões.'
  await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS })
  return result
}

// ─────────────────────────────────────────────────────────────────
// Financial Health Score
// ─────────────────────────────────────────────────────────────────

export interface HealthScoreInput {
  period: { dateFrom: string; dateTo: string }
  costs: {
    summary: { total: number; count: number; average: number }
    byArea: Array<{ areaId: string; areaName: string; total: number }>
    byMonth: Array<{ month: string; total: number }>
  }
  incomes: {
    summary: { total: number; count: number; average: number }
    byMonth: Array<{ month: string; total: number }>
    byType: Array<{ type: string; label: string; total: number; count: number }>
  }
}

function buildHealthScorePrompt(input: HealthScoreInput): string {
  const brl = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const pct = (v: number) => `${v.toFixed(1)}%`

  const periodMonths = (() => {
    const from = new Date(input.period.dateFrom)
    const to   = new Date(input.period.dateTo)
    const diff = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1
    return Math.max(1, diff)
  })()

  const totalIncome  = input.incomes.summary.total
  const totalCosts   = input.costs.summary.total
  const savingAmount = totalIncome - totalCosts
  const savingRate   = totalIncome > 0 ? (savingAmount / totalIncome) * 100 : 0
  const avgMonthlyCost = totalCosts / periodMonths
  // Runway = how many months of expenses saved (saving amount over period / avg monthly cost)
  const runwayMonths = avgMonthlyCost > 0 ? savingAmount / avgMonthlyCost : 0

  const formatMonth = (ym: string) => {
    const [year, month] = ym.split('-')
    const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${names[parseInt(month, 10) - 1]}/${year.slice(2)}`
  }

  const costByAreaText = input.costs.byArea.length
    ? input.costs.byArea
        .sort((a, b) => b.total - a.total)
        .map((a) => `  - ${a.areaName}: ${brl(a.total)} (${totalCosts > 0 ? pct((a.total / totalCosts) * 100) : '—'} dos custos)`)
        .join('\n')
    : '  Sem dados por área.'

  const costByMonthText = input.costs.byMonth.length
    ? input.costs.byMonth.map((m) => `  - ${formatMonth(m.month)}: ${brl(m.total)}`).join('\n')
    : '  Sem dados mensais.'

  const incomeByMonthText = input.incomes.byMonth.length
    ? input.incomes.byMonth.map((m) => `  - ${formatMonth(m.month)}: ${brl(m.total)}`).join('\n')
    : '  Sem dados mensais.'

  const incomeByTypeText = input.incomes.byType.length
    ? input.incomes.byType.map((t) => `  - ${t.label}: ${brl(t.total)} (${t.count} lançamentos)`).join('\n')
    : '  Sem dados por fonte.'

  return `Você é um especialista em saúde financeira pessoal para o mercado brasileiro.

Analise o perfil financeiro do usuário no período de ${input.period.dateFrom} a ${input.period.dateTo} (${periodMonths} mês(es)) e gere um relatório de saúde financeira.

RESUMO GERAL:
- Renda total: ${brl(totalIncome)}
- Custos totais: ${brl(totalCosts)}
- Resultado (renda - custos): ${brl(savingAmount)}
- Taxa de poupança: ${pct(savingRate)}
- Gasto médio mensal: ${brl(avgMonthlyCost)}
- Runway (meses de custo poupados no período): ${runwayMonths.toFixed(1)} meses

CUSTOS POR ÁREA:
${costByAreaText}

EVOLUÇÃO MENSAL DOS CUSTOS:
${costByMonthText}

RENDA POR FONTE:
${incomeByTypeText}

EVOLUÇÃO MENSAL DA RENDA:
${incomeByMonthText}

Responda EXATAMENTE neste formato:
SCORE: X/10
• [dimensão 1]: análise da taxa de poupança e comparação com benchmarks (20% ideal)
• [dimensão 2]: análise do burn rate e runway — quantos meses de reserva de emergência estão sendo gerados
• [dimensão 3]: análise da composição dos custos por área — identifique concentração ou desequilíbrio
• [dimensão 4]: análise da estabilidade e diversificação da renda
• [dimensão 5]: recomendação prioritária de ação concreta para melhorar a saúde financeira

Regras:
- Primeira linha OBRIGATORIAMENTE: "SCORE: X/10" — onde X é um número inteiro de 0 a 10 baseado nos seguintes critérios:
  - Taxa de poupança ≥ 30% → +3 pontos; 20-29% → +2; 10-19% → +1; ≤ 0% → -2
  - Runway gerado ≥ 6 meses → +3 pontos; 3-5 → +2; 1-2 → +1; ≤ 0 → -1
  - Diversificação de renda (≥3 fontes → +1; 1-2 → 0)
  - Concentração de custos (nenhuma área > 40% → +1; alguma > 60% → -1)
  - Comece do 5 e ajuste pelos critérios acima; limite entre 1 e 10
- Linhas seguintes: exatamente 5 bullets começando com "•"
- Português do Brasil, direto ao ponto, sem jargão excessivo`
}

export async function scoreFinancialHealth(userId: string, input: HealthScoreInput): Promise<string> {
  if (!process.env.OPENAI_API_KEY && !isOpenAiMockEnabled()) {
    throw Object.assign(new Error('Serviço de IA não configurado.'), { statusCode: 503 })
  }

  const cacheKey = `ai:health-score:${userId}:${input.period.dateFrom}:${input.period.dateTo}`
  const cached = await redis.get<string>(cacheKey)
  if (cached) return cached

  await checkRateLimit(userId)

  if (isOpenAiMockEnabled()) {
    const result = buildMockHealthScore(input)
    await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS })
    return result
  }

  const prompt = buildHealthScorePrompt(input)

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 700,
    temperature: 0.6,
  })

  const result = completion.choices[0]?.message?.content?.trim() ?? 'Não foi possível gerar o score.'
  await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS })
  return result
}

// ─────────────────────────────────────────────────────────────────
// Cost Area & Description Suggestion
// ─────────────────────────────────────────────────────────────────

export interface CostSuggestionInput {
  input: string
  areas: Array<{ id: string; name: string }>
  types: Array<{ id: string; name: string; areaId: string }>
}

export interface CostSuggestionResult {
  amount: number
  areaId: string
  areaName: string
  costTypeId: string | null
  costTypeName: string
  description: string
}

function buildCostSuggestionPrompt(input: CostSuggestionInput): string {
  const areasList = input.areas
    .map((a) => `  {"id":"${a.id}","name":"${a.name}"}`)
    .join('\n')

  const typesList = input.types.length
    ? input.types
        .map((t) => `  {"id":"${t.id}","name":"${t.name}","areaId":"${t.areaId}"}`)
        .join('\n')
    : '  (nenhum tipo cadastrado ainda)'

  return `Você é um assistente de categorização de gastos domésticos para o mercado brasileiro.

O usuário registrou o seguinte gasto:
"${input.input}"

ÁREAS DISPONÍVEIS:
${areasList}

TIPOS DE CUSTO DO USUÁRIO (vinculados às áreas acima):
${typesList}

Sua tarefa:
1. Extraia o valor monetário do texto. Aceite formatos como: 250, 49.90, 1500,00, R$ 250, R$1.500,00. Use ponto como separador decimal no resultado numérico.
2. Identifique a área mais adequada da lista.
3. Se já existir um tipo de custo compatível, use seu "id" em costTypeId. Se não houver correspondência adequada, defina costTypeId como null e sugira um novo nome em costTypeName.
4. Gere uma descrição objetiva e padronizada em português do Brasil (máximo 60 caracteres).

Responda EXCLUSIVAMENTE em JSON válido, sem blocos de código, sem texto extra:
{"amount":0.00,"areaId":"","areaName":"","costTypeId":null,"costTypeName":"","description":""}`
}

export async function suggestCostAreaAndDescription(
  userId: string,
  input: CostSuggestionInput,
): Promise<CostSuggestionResult> {
  if (!process.env.OPENAI_API_KEY && !isOpenAiMockEnabled()) {
    throw Object.assign(new Error('Serviço de IA não configurado.'), { statusCode: 503 })
  }

  await checkRateLimit(userId)

  if (isOpenAiMockEnabled()) {
    return buildMockCostSuggestion(input)
  }

  const prompt = buildCostSuggestionPrompt(input)

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  })

  const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw Object.assign(new Error('Resposta inválida da IA.'), { statusCode: 502 })
  }

  const { amount, areaId, areaName, costTypeId, costTypeName, description } =
    parsed as Record<string, unknown>

  if (
    typeof amount !== 'number' ||
    typeof areaId !== 'string' ||
    typeof areaName !== 'string' ||
    typeof costTypeName !== 'string' ||
    typeof description !== 'string'
  ) {
    throw Object.assign(new Error('Não foi possível gerar a sugestão.'), { statusCode: 502 })
  }

  if (amount <= 0 || !isFinite(amount)) {
    throw Object.assign(new Error('Não foi possível extrair um valor válido do texto.'), { statusCode: 422 })
  }

  // Validate areaId belongs to the provided list
  const validArea = input.areas.find((a) => a.id === areaId)
  if (!validArea) {
    throw Object.assign(new Error('Área sugerida inválida.'), { statusCode: 502 })
  }

  // Validate costTypeId if present
  const resolvedTypeId: string | null =
    typeof costTypeId === 'string' && input.types.some((t) => t.id === costTypeId)
      ? costTypeId
      : null

  return {
    amount: Math.round(amount * 100) / 100,
    areaId: validArea.id,
    areaName: validArea.name,
    costTypeId: resolvedTypeId,
    costTypeName: costTypeName.slice(0, 80),
    description: description.slice(0, 120),
  }
}
