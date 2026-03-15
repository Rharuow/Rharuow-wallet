import OpenAI from 'openai'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'

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
