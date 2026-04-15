import crypto from 'node:crypto'
import path from 'node:path'
import OpenAI from 'openai'
import { PDFParse } from 'pdf-parse'
import {
  AssetReportAssetType,
  AssetReportSourceKind,
  CreditLedgerEntryKind,
  PlanType,
  Prisma,
  ReportMode,
} from '@prisma/client'
import { appLogger } from '../../lib/logger'
import { getObject, putObject } from '../../lib/object-storage'
import { isOpenAiMockEnabled } from '../../lib/openai-mode'
import { prisma } from '../../lib/prisma'
import { getCreditBalance } from '../credits/credits.service'
import { getFii } from '../fiis/fiis.service'
import type { FiiItem } from '../fiis/fiis.schema'
import { getStockDetail } from '../stocks/stocks.service'
import type { StockDetail } from '../stocks/stocks.schema'
import {
  findActiveAssetReportAccess,
  findReusableAssetReportAnalysis,
  upsertAssetReportAnalysis,
  upsertAssetReportSource,
} from './report-analysis.service'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const REPORT_PRICE_BY_MODE: Record<ReportMode, Record<PlanType, number>> = {
  BRAPI_TICKER: {
    FREE: 2.5,
    PREMIUM: 1.5,
  },
  RI_UPLOAD_AI: {
    FREE: 4.0,
    PREMIUM: 2.5,
  },
}

const REPORT_ACCESS_TTL_DAYS = 30
const MANUAL_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
const MANUAL_UPLOAD_MIN_TEXT_LENGTH = 120
const MANUAL_UPLOAD_CONTEXT_LIMIT = 12_000

type JsonValue = Prisma.InputJsonValue

type ResolvedReportSource = {
  assetType: AssetReportAssetType
  ticker: string
  sourceKind: AssetReportSourceKind
  sourceUrl?: string | null
  storageKey?: string | null
  originalFileName?: string | null
  documentFingerprint: string
  metadata: JsonValue
  promptContext: string
}

function isJsonObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type ReportRuntime = {
  resolveAutoSource?: (input: {
    assetType: AssetReportAssetType
    ticker: string
  }) => Promise<ResolvedReportSource | null>
  resolveWebSearchSource?: (input: {
    assetType: AssetReportAssetType
    ticker: string
  }) => Promise<ResolvedReportSource | null>
  generateAnalysis?: (input: {
    assetType: AssetReportAssetType
    ticker: string
    promptContext: string
  }) => Promise<string>
  buildValuationAppendix?: (input: {
    assetType: AssetReportAssetType
    ticker: string
  }) => Promise<string[]>
  now?: () => Date
}

const BAZIN_TARGET_YIELD_PERCENT = 6

function serviceError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode })
}

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase()
}

function toMonthKey(now: Date) {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function resolveCurrentMonthValidityEnd(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
}

function decimalToString(value: Prisma.Decimal | number | string) {
  return new Prisma.Decimal(value).toString()
}

function hashFingerprint(payload: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function hashText(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function shouldLogReportSourceDebug() {
  return process.env.REPORT_SOURCE_DEBUG === 'true'
}

function logReportSourceDebug(event: string, payload: Record<string, unknown>) {
  if (!shouldLogReportSourceDebug()) {
    return
  }

  appLogger.debug('reports-source-debug', {
    event,
    ...payload,
  })
}

function previewDebugText(value: string, maxLength = 400) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength)}...`
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasExactToken(text: string, token: string) {
  const normalizedText = ` ${normalizeSearchText(text)} `
  const normalizedToken = normalizeSearchText(token)

  if (!normalizedToken) {
    return false
  }

  return normalizedText.includes(` ${normalizedToken} `)
}

function hasStrongAliasMatch(text: string, alias: string) {
  const normalizedAlias = normalizeSearchText(alias)
  if (normalizedAlias.length < 6) {
    return false
  }

  return normalizeSearchText(text).includes(normalizedAlias)
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${value.toFixed(2)}%`
}

function formatRatio(value: number | null | undefined) {
  if (value == null) return '—'
  return value.toFixed(2)
}

function formatNumber(value: number, fractionDigits = 2) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

function normalizeYieldPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return null
  }

  return value <= 1 ? value * 100 : value
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, '').replace(',', '.').trim()
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function findFirstNumberByKeys(source: unknown, keys: string[]) {
  const pending: unknown[] = [source]
  const visited = new Set<unknown>()
  const keySet = new Set(keys.map((key) => key.toLowerCase()))

  while (pending.length > 0) {
    const current = pending.shift()
    if (current == null || typeof current !== 'object') {
      continue
    }

    if (visited.has(current)) {
      continue
    }

    visited.add(current)

    if (Array.isArray(current)) {
      for (const item of current) {
        pending.push(item)
      }
      continue
    }

    for (const [entryKey, entryValue] of Object.entries(current)) {
      if (keySet.has(entryKey.toLowerCase())) {
        const parsed = toFiniteNumber(entryValue)
        if (parsed != null) {
          return parsed
        }
      }

      if (entryValue != null && typeof entryValue === 'object') {
        pending.push(entryValue)
      }
    }
  }

  return null
}

function resolveStockBookValueForGraham(snapshot: ReturnType<typeof buildStockSnapshot>) {
  const fromBookValue = snapshot.defaultKeyStatistics.bookValue
  if (fromBookValue != null && fromBookValue > 0) {
    return fromBookValue
  }

  const price = snapshot.regularMarketPrice
  const priceToBook = snapshot.defaultKeyStatistics.priceToBook
  if (
    price != null && price > 0 &&
    priceToBook != null && priceToBook > 0
  ) {
    return price / priceToBook
  }

  return null
}

function resolveStockBazinInputs(snapshot: ReturnType<typeof buildStockSnapshot>) {
  const inferredDividendYield = normalizeYieldPercent(
    snapshot.summaryDetail.dividendYield ??
    snapshot.defaultKeyStatistics.trailingAnnualDividendYield,
  )

  const inferredAnnualDividend =
    snapshot.summaryDetail.dividendRate ??
    snapshot.defaultKeyStatistics.trailingAnnualDividendRate ??
    (
      snapshot.summaryDetail.lastDividendValue != null &&
      snapshot.summaryDetail.lastDividendValue > 0
        ? snapshot.summaryDetail.lastDividendValue * 4
        : null
    )

  return {
    dividendYieldPercent: inferredDividendYield,
    annualDividendPerShare: inferredAnnualDividend,
  }
}

function describeFairPriceGap(fairPrice: number, currentPrice: number) {
  const relativeDelta = ((fairPrice / currentPrice) - 1) * 100

  if (Math.abs(relativeDelta) < 0.25) {
    return 'muito próximo do preço atual'
  }

  if (relativeDelta > 0) {
    return `potencial teórico de alta de ${formatNumber(relativeDelta)}% sobre o preço atual`
  }

  return `prêmio de ${formatNumber(Math.abs(relativeDelta))}% sobre o preço justo estimado`
}

function buildStockGrahamBullet(snapshot: ReturnType<typeof buildStockSnapshot>) {
  const currentPrice = snapshot.regularMarketPrice
  const earningsPerShare = snapshot.earningsPerShare
  const bookValue = resolveStockBookValueForGraham(snapshot)

  if (
    currentPrice == null || currentPrice <= 0 ||
    earningsPerShare == null || earningsPerShare <= 0 ||
    bookValue == null || bookValue <= 0
  ) {
    return 'Fórmula de Graham: não foi possível calcular com confiança porque faltam LPA/EPS positivo e valor patrimonial por ação consistentes no snapshot atual.'
  }

  const fairPrice = Math.sqrt(22.5 * earningsPerShare * bookValue)

  return `Fórmula de Graham: √(22,5 × LPA × VPA) = √(22,5 × ${formatNumber(earningsPerShare)} × ${formatNumber(bookValue)}) = ${formatCurrency(fairPrice)}. Preço atual: ${formatCurrency(currentPrice)}; isso sugere ${describeFairPriceGap(fairPrice, currentPrice)}.`
}

function buildBazinBullet(input: {
  currentPrice: number | null | undefined
  dividendYieldPercent: number | null | undefined
  annualDividendPerShare?: number | null | undefined
  assetLabel: string
}) {
  const currentPrice = input.currentPrice
  const dividendYieldPercent = normalizeYieldPercent(input.dividendYieldPercent)
  const annualDividendPerShare = input.annualDividendPerShare ?? (
    currentPrice != null && dividendYieldPercent != null
      ? currentPrice * (dividendYieldPercent / 100)
      : null
  )

  if (
    currentPrice == null || currentPrice <= 0 ||
    dividendYieldPercent == null || dividendYieldPercent <= 0 ||
    annualDividendPerShare == null || annualDividendPerShare <= 0
  ) {
    return `Fórmula de Bazin (${input.assetLabel}): não foi possível calcular com confiança porque faltam DY ou dividendo anual por ação/cota no snapshot atual.`
  }

  const fairPrice = annualDividendPerShare / (BAZIN_TARGET_YIELD_PERCENT / 100)

  return `Fórmula de Bazin (${input.assetLabel}): Preço justo = Dividendo anual ÷ ${formatNumber(BAZIN_TARGET_YIELD_PERCENT)}%. Com DY atual de ${formatNumber(dividendYieldPercent)}% e provento anual estimado de ${formatCurrency(annualDividendPerShare)}, o preço justo estimado é ${formatCurrency(fairPrice)}. Preço atual: ${formatCurrency(currentPrice)}; isso sugere ${describeFairPriceGap(fairPrice, currentPrice)}.`
}

async function defaultBuildValuationAppendix(input: {
  assetType: AssetReportAssetType
  ticker: string
}) {
  if (process.env.NODE_ENV === 'test') {
    return []
  }

  if (input.assetType === AssetReportAssetType.STOCK) {
    const stock = await getStockDetail(input.ticker)
    if (!stock) {
      return []
    }

    const snapshot = buildStockSnapshot(stock)
    const bazin = resolveStockBazinInputs(snapshot)
    return [
      buildStockGrahamBullet(snapshot),
      buildBazinBullet({
        currentPrice: snapshot.regularMarketPrice,
        dividendYieldPercent: bazin.dividendYieldPercent,
        annualDividendPerShare: bazin.annualDividendPerShare,
        assetLabel: 'ação',
      }),
    ]
  }

  const fii = await getFii(input.ticker)
  if (!fii) {
    return []
  }

  const snapshot = buildFiiSnapshot(fii)

  return [
    'Fórmula de Graham: não foi calculada para FIIs neste relatório automático, porque a abordagem clássica depende de lucro por ação/cota e valor patrimonial por ação comparáveis, o que não está disponível com consistência nesta fonte.',
    buildBazinBullet({
      currentPrice: snapshot.cotacao,
      dividendYieldPercent: snapshot.dividendYield,
      assetLabel: 'FII',
    }),
  ]
}

function appendValuationAppendix(analysisText: string, appendixBullets: string[]) {
  const normalizedBullets = appendixBullets
    .map((bullet) => bullet.trim())
    .filter(Boolean)
    .map((bullet) => bullet.startsWith('•') ? bullet : `• ${bullet}`)

  if (normalizedBullets.length === 0) {
    return analysisText
  }

  return `${analysisText.trim()}\n${normalizedBullets.join('\n')}`
}

export function mergeResolvedReportSourceWithStructuredFallback(
  primarySource: ResolvedReportSource,
  supplementalSource: ResolvedReportSource,
): ResolvedReportSource {
  const supplementalProvider = supplementalSource.assetType === AssetReportAssetType.STOCK
    ? 'BRAPI'
    : 'FUNDAMENTUS'
  const mergedPrimaryMetadata = isJsonObject(primarySource.metadata)
    ? primarySource.metadata
    : { primaryMetadata: primarySource.metadata }

  return {
    ...primarySource,
    documentFingerprint: hashFingerprint({
      primaryFingerprint: primarySource.documentFingerprint,
      supplementalFingerprint: supplementalSource.documentFingerprint,
    }),
    metadata: {
      ...mergedPrimaryMetadata,
      supplementalSource: {
        provider: supplementalProvider,
        sourceUrl: supplementalSource.sourceUrl ?? null,
        metadata: supplementalSource.metadata,
      },
    },
    promptContext: [
      primarySource.promptContext.trim(),
      '',
      supplementalSource.assetType === AssetReportAssetType.STOCK
        ? 'Dados estruturados complementares do BRAPI: use estes campos para preencher lacunas de demonstracoes financeiras, valuation, dividendos e indicadores quando o resumo oficial nao trouxer detalhes suficientes.'
        : 'Dados estruturados complementares do Fundamentus: use estes campos para preencher lacunas de renda, vacancia, cap rate, portfolio e valuation quando o resumo oficial nao trouxer detalhes suficientes.',
      '',
      supplementalSource.promptContext.trim(),
    ].join('\n'),
  }
}

async function resolveStockAutoSource(ticker: string): Promise<ResolvedReportSource | null> {
  const stock = await getStockDetail(ticker)
  if (!stock) {
    return null
  }

  const snapshot = buildStockSnapshot(stock)
  return {
    assetType: AssetReportAssetType.STOCK,
    ticker,
    sourceKind: AssetReportSourceKind.AUTO_FOUND,
    sourceUrl: `https://brapi.dev/quote/${ticker}`,
    documentFingerprint: hashFingerprint(snapshot),
    metadata: snapshot,
    promptContext: buildStockPromptContext(snapshot),
  }
}

async function resolveFiiAutoSource(ticker: string): Promise<ResolvedReportSource | null> {
  const fii = await getFii(ticker)
  if (!fii) {
    return null
  }

  const snapshot = buildFiiSnapshot(fii)
  return {
    assetType: AssetReportAssetType.FII,
    ticker,
    sourceKind: AssetReportSourceKind.AUTO_FOUND,
    sourceUrl: `https://www.fundamentus.com.br/detalhes.php?papel=${ticker}`,
    documentFingerprint: hashFingerprint(snapshot),
    metadata: snapshot,
    promptContext: buildFiiPromptContext(snapshot),
  }
}

function buildWebSearchPrompt(input: {
  assetType: AssetReportAssetType
  ticker: string
}) {
  const assetLabel = input.assetType === AssetReportAssetType.FII ? 'FII brasileiro listado na B3' : 'acao brasileira listada na B3'
  const documentHints = input.assetType === AssetReportAssetType.FII
    ? [
        'Priorize documentos oficiais do fundo, da gestora ou da administradora.',
        'Busque por relatorio gerencial, informe mensal, fatos relevantes, comunicados ao mercado ou pagina oficial de relacoes com investidores/documentos.',
      ]
    : [
        'Priorize documentos oficiais de RI/IR da companhia.',
        'Busque por release de resultados, apresentacao de resultados, ITR, DFP, formulario de referencia ou pagina oficial de relacoes com investidores.',
      ]

  return [
    'Encontre uma fonte oficial e recente para analise fundamentalista do ativo abaixo.',
    `Ticker: ${input.ticker}`,
    `Tipo: ${assetLabel}`,
    ...documentHints,
    'Prefira URL oficial de RI, site da companhia, site do fundo, gestora, administradora ou documento hospedado nesses domínios.',
    'Responda apenas em JSON valido sem markdown.',
    'Campos esperados:',
    '{',
    '  "found": boolean,',
    '  "sourceUrl": string | null,',
    '  "title": string | null,',
    '  "summary": string | null,',
    '  "publisher": string | null,',
    '  "sourceType": string | null',
    '}',
    'Se nao encontrar fonte util, retorne found=false e os demais campos como null.',
  ].join('\n')
}

function parseWebSearchResult(raw: string) {
  const parsed = JSON.parse(raw) as {
    found?: boolean
    sourceUrl?: string | null
    title?: string | null
    summary?: string | null
    publisher?: string | null
    sourceType?: string | null
  }

  if (!parsed.found || !parsed.sourceUrl || !parsed.summary) {
    return null
  }

  return {
    sourceUrl: parsed.sourceUrl,
    title: parsed.title ?? null,
    summary: parsed.summary,
    publisher: parsed.publisher ?? null,
    sourceType: parsed.sourceType ?? null,
  }
}

async function defaultResolveWebSearchSource(input: {
  assetType: AssetReportAssetType
  ticker: string
}): Promise<ResolvedReportSource | null> {
  if (isOpenAiMockEnabled()) {
    const sourceUrl = input.assetType === AssetReportAssetType.FII
      ? `https://mock.ri.local/${input.ticker.toLowerCase()}/relatorio-gerencial`
      : `https://mock.ri.local/${input.ticker.toLowerCase()}/relacoes-com-investidores`
    const title = input.assetType === AssetReportAssetType.FII
      ? `Relatório gerencial mock de ${input.ticker}`
      : `Central de resultados mock de ${input.ticker}`
    const publisher = input.assetType === AssetReportAssetType.FII ? 'Gestora mock' : 'RI mock'
    const sourceType = input.assetType === AssetReportAssetType.FII ? 'RELATORIO_GERENCIAL' : 'RESULTADOS_TRIMESTRAIS'
    const summary = input.assetType === AssetReportAssetType.FII
      ? `Resumo mock de documento oficial para ${input.ticker}, usado apenas em desenvolvimento para evitar consumo de token.`
      : `Resumo mock de fonte oficial de RI para ${input.ticker}, usado apenas em desenvolvimento para evitar consumo de token.`

    logReportSourceDebug('web-search-mocked', {
      assetType: input.assetType,
      ticker: input.ticker,
      sourceUrl,
    })

    return {
      assetType: input.assetType,
      ticker: input.ticker,
      sourceKind: AssetReportSourceKind.AUTO_FOUND,
      sourceUrl,
      documentFingerprint: hashFingerprint({
        ticker: input.ticker,
        sourceUrl,
        summary,
        title,
        publisher,
        sourceType,
        discoveryMethod: 'OFFICIAL_IR_WEB_SEARCH_MOCK',
      }),
      metadata: {
        discoveryMethod: 'OFFICIAL_IR_WEB_SEARCH_MOCK',
        title,
        publisher,
        sourceType,
        summary,
      },
      promptContext: [
        'Voce e um analista buy and hold do mercado brasileiro.',
        `Analise o ativo ${input.ticker} usando esta fonte mockada de desenvolvimento.`,
        `Fonte: ${title} (${publisher})`,
        `URL: ${sourceUrl}`,
        `Tipo da fonte: ${sourceType}`,
        '',
        'Resumo util da fonte oficial mockada:',
        summary,
        '',
        'Responda em portugues do Brasil com exatamente 5 bullets, cada um comecando com "•".',
        'Cubra qualidade do ativo, riscos, leitura do momento e conclusao pratica.',
      ].join('\n'),
    }
  }

  if (process.env.REPORT_AUTO_WEB_SEARCH_ENABLED !== 'true') {
    logReportSourceDebug('web-search-skipped', {
      assetType: input.assetType,
      ticker: input.ticker,
      reason: `REPORT_AUTO_WEB_SEARCH_ENABLED = ${process.env.REPORT_AUTO_WEB_SEARCH_ENABLED}`,
    })
    return null
  }

  if (!process.env.OPENAI_API_KEY) {
    logReportSourceDebug('web-search-skipped', {
      assetType: input.assetType,
      ticker: input.ticker,
      reason: 'OPENAI_API_KEY_MISSING',
    })
    return null
  }

  const responsesApi = (openai as unknown as {
    responses?: {
      create: (input: Record<string, unknown>) => Promise<{ output_text?: string }>
    }
  }).responses

  if (!responsesApi) {
    logReportSourceDebug('web-search-skipped', {
      assetType: input.assetType,
      ticker: input.ticker,
      reason: 'OPENAI_RESPONSES_API_UNAVAILABLE',
    })
    return null
  }

  logReportSourceDebug('web-search-started', {
    assetType: input.assetType,
    ticker: input.ticker,
    model: process.env.OPENAI_WEB_SEARCH_MODEL ?? 'gpt-4.1-mini',
  })

  const response = await responsesApi.create({
    model: process.env.OPENAI_WEB_SEARCH_MODEL ?? 'gpt-4.1-mini',
    tools: [{ type: 'web_search_preview' }],
    input: buildWebSearchPrompt(input),
  })

  const outputText = response.output_text?.trim()
  if (!outputText) {
    logReportSourceDebug('web-search-empty-output', {
      assetType: input.assetType,
      ticker: input.ticker,
    })
    return null
  }

  logReportSourceDebug('web-search-output-received', {
    assetType: input.assetType,
    ticker: input.ticker,
    outputPreview: previewDebugText(outputText),
  })

  let result: ReturnType<typeof parseWebSearchResult>
  try {
    result = parseWebSearchResult(outputText)
  } catch (error) {
    logReportSourceDebug('web-search-parse-failed', {
      assetType: input.assetType,
      ticker: input.ticker,
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    })
    return null
  }

  if (!result) {
    logReportSourceDebug('web-search-no-usable-result', {
      assetType: input.assetType,
      ticker: input.ticker,
    })
    return null
  }

  logReportSourceDebug('web-search-source-found', {
    assetType: input.assetType,
    ticker: input.ticker,
    sourceUrl: result.sourceUrl,
    title: result.title,
    publisher: result.publisher,
    sourceType: result.sourceType,
  })

  const promptContext = [
    `Voce e um analista buy and hold do mercado brasileiro.`,
    `Analise o ativo ${input.ticker} usando este resumo de documento ou pagina oficial localizada via busca web controlada.`,
    `Fonte: ${result.title ?? 'Fonte publica'}${result.publisher ? ` (${result.publisher})` : ''}`,
    `URL: ${result.sourceUrl}`,
    result.sourceType ? `Tipo da fonte: ${result.sourceType}` : null,
    '',
    'Resumo util da fonte oficial:',
    result.summary,
    '',
    'Responda em portugues do Brasil com exatamente 5 bullets, cada um comecando com "•".',
    'Cubra qualidade do ativo, riscos, leitura do momento e conclusao pratica.',
  ].filter(Boolean).join('\n')

  return {
    assetType: input.assetType,
    ticker: input.ticker,
    sourceKind: AssetReportSourceKind.AUTO_FOUND,
    sourceUrl: result.sourceUrl,
    documentFingerprint: hashFingerprint({
      ticker: input.ticker,
      sourceUrl: result.sourceUrl,
      summary: result.summary,
      title: result.title,
      publisher: result.publisher,
      sourceType: result.sourceType,
      discoveryMethod: 'OFFICIAL_IR_WEB_SEARCH',
    }),
    metadata: {
      discoveryMethod: 'OFFICIAL_IR_WEB_SEARCH',
      title: result.title,
      publisher: result.publisher,
      sourceType: result.sourceType,
      summary: result.summary,
    },
    promptContext,
  }
}

async function defaultResolveAutoSource(input: {
  assetType: AssetReportAssetType
  ticker: string
}): Promise<ResolvedReportSource | null> {
  const ticker = normalizeTicker(input.ticker)
  const localSource = await (
    input.assetType === AssetReportAssetType.STOCK
      ? resolveStockAutoSource(ticker)
      : resolveFiiAutoSource(ticker)
  )

  if (localSource) {
    logReportSourceDebug('source-selected', {
      assetType: input.assetType,
      ticker,
      selected: input.assetType === AssetReportAssetType.STOCK ? 'BRAPI_PRIMARY' : 'FUNDAMENTUS_PRIMARY',
      sourceUrl: localSource.sourceUrl ?? null,
    })
    return localSource
  }

  logReportSourceDebug('source-not-found', {
    assetType: input.assetType,
    ticker,
  })

  return null
}

async function defaultGenerateAnalysis(input: {
  assetType: AssetReportAssetType
  ticker: string
  promptContext: string
}) {
  if (process.env.NODE_ENV === 'test' || isOpenAiMockEnabled()) {
    return buildDeterministicTestAnalysis(input)
  }

  if (!process.env.OPENAI_API_KEY) {
    throw serviceError('REPORT_ANALYSIS_AI_NOT_CONFIGURED', 503)
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: input.promptContext }],
    max_tokens: 700,
    temperature: 0.5,
  })

  const text = completion.choices[0]?.message?.content?.trim()
  if (!text) {
    throw serviceError('REPORT_ANALYSIS_EMPTY_RESPONSE', 502)
  }

  return text
}

function buildDeterministicTestAnalysis(input: {
  assetType: AssetReportAssetType
  ticker: string
  promptContext: string
}) {
  const normalizedContext = input.promptContext.replace(/\s+/g, ' ').trim()
  const excerpt = normalizedContext.slice(0, 180) || 'Documento-base carregado com sucesso.'
  const assetLabel = input.assetType === AssetReportAssetType.FII ? 'FII' : 'acao'

  return [
    `• Visao geral: ${input.ticker} (${assetLabel}) teve o documento-base processado com sucesso no ambiente de teste.`,
    `• Base analisada: ${excerpt}.`,
    '• Pontos fortes: a estrutura de dados entregue e suficiente para uma leitura resumida inicial.',
    '• Riscos: confirme a atualizacao do documento e valide as premissas mais sensiveis antes de decidir.',
    '• Conclusao pratica: use esta analise como triagem rapida e aprofunde a diligencia se o ativo seguir no radar.',
  ].join('\n')
}

function normalizeManualText(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function resolveManualFileKind(input: { originalFileName: string; contentType?: string }) {
  const lowerName = input.originalFileName.toLowerCase()
  const lowerType = input.contentType?.toLowerCase() ?? ''

  if (lowerType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return 'pdf' as const
  }

  if (
    lowerType.startsWith('text/') ||
    lowerType === 'application/json' ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.json') ||
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm')
  ) {
    return 'text' as const
  }

  throw serviceError('REPORT_SOURCE_MANUAL_UNSUPPORTED_FILE', 415)
}

async function extractManualUploadText(input: {
  originalFileName: string
  contentType?: string
  buffer: Buffer
}) {
  if (!input.buffer.byteLength) {
    throw serviceError('REPORT_SOURCE_MANUAL_INVALID_FILE', 400)
  }

  if (input.buffer.byteLength > MANUAL_UPLOAD_MAX_BYTES) {
    throw serviceError('REPORT_SOURCE_MANUAL_FILE_TOO_LARGE', 413)
  }

  const fileKind = resolveManualFileKind(input)
  const rawText = fileKind === 'pdf'
    ? (await new PDFParse({ data: input.buffer }).getText()).text
    : input.buffer.toString('utf8')
  const normalizedText = normalizeManualText(rawText.replace(/<[^>]+>/g, ' '))

  if (normalizedText.length < MANUAL_UPLOAD_MIN_TEXT_LENGTH) {
    throw serviceError('REPORT_SOURCE_MANUAL_CONTENT_TOO_SHORT', 422)
  }

  return {
    text: normalizedText,
    fileSizeBytes: input.buffer.byteLength,
  }
}

function decodeManualUploadBase64(fileBase64: string) {
  const buffer = Buffer.from(fileBase64, 'base64')

  if (!buffer.byteLength) {
    throw serviceError('REPORT_SOURCE_MANUAL_INVALID_FILE', 400)
  }

  return buffer
}

function buildManualUploadStorageKey(input: {
  assetType: AssetReportAssetType
  ticker: string
  originalFileName: string
  fileBuffer: Buffer
}) {
  const extension = path.extname(input.originalFileName).toLowerCase()
  const fingerprint = hashText(`${input.assetType}:${input.ticker}:${input.originalFileName}:${input.fileBuffer.toString('base64')}`)

  return `manual-report/${input.assetType.toLowerCase()}/${input.ticker}/${fingerprint}${extension}`
}

async function resolveManualUploadBuffer(input: {
  fileBase64?: string
  storageKey?: string
}) {
  if (input.storageKey) {
    try {
      const stored = await getObject({ key: input.storageKey })
      return {
        buffer: stored.body,
        storageKey: stored.key,
      }
    } catch {
      throw serviceError('REPORT_SOURCE_MANUAL_STORAGE_NOT_FOUND', 404)
    }
  }

  if (!input.fileBase64) {
    throw serviceError('REPORT_SOURCE_MANUAL_INVALID_FILE', 400)
  }

  return {
    buffer: decodeManualUploadBase64(input.fileBase64),
    storageKey: null,
  }
}

export async function storeManualUploadObject(input: {
  assetType: AssetReportAssetType
  ticker: string
  originalFileName: string
  contentType?: string
  fileBase64: string
}) {
  const buffer = decodeManualUploadBase64(input.fileBase64)
  const ticker = normalizeTicker(input.ticker)
  const extracted = await extractManualUploadText({
    originalFileName: input.originalFileName,
    contentType: input.contentType,
    buffer,
  })
  const storageKey = buildManualUploadStorageKey({
    assetType: input.assetType,
    ticker,
    originalFileName: input.originalFileName,
    fileBuffer: buffer,
  })

  await putObject({
    key: storageKey,
    body: buffer,
  })

  return {
    storageKey,
    fileSizeBytes: extracted.fileSizeBytes,
  }
}

function buildManualPromptContext(input: {
  assetType: AssetReportAssetType
  ticker: string
  originalFileName: string
  documentText: string
}) {
  const documentText = input.documentText.slice(0, MANUAL_UPLOAD_CONTEXT_LIMIT)
  const assetLabel = input.assetType === AssetReportAssetType.FII ? 'FII' : 'acao'

  return `Voce e um analista buy and hold do mercado brasileiro.

Analise o ${assetLabel} ${input.ticker} usando o relatorio/manual enviado pelo usuario.

Arquivo: ${input.originalFileName}
Ticker informado: ${input.ticker}

Trecho util do documento-base:
${documentText}

Responda em portugues do Brasil com exatamente 5 bullets, cada um comecando com "•".
Cubra qualidade do negocio ou portfolio, valuation/renda quando possivel, principais riscos, leitura do momento e conclusao pratica.`
}

async function validateManualReportBelongsToAsset(input: {
  assetType: AssetReportAssetType
  ticker: string
  documentText: string
}) {
  if (hasExactToken(input.documentText, input.ticker)) {
    return {
      matchedBy: 'ticker' as const,
    }
  }

  if (input.assetType === AssetReportAssetType.STOCK) {
    const stock = await getStockDetail(input.ticker)
    const aliases = [stock?.shortName, stock?.longName]
      .filter((alias): alias is string => Boolean(alias?.trim()))

    const matchedAlias = aliases.find((alias) => hasStrongAliasMatch(input.documentText, alias))
    if (matchedAlias) {
      return {
        matchedBy: 'company-name' as const,
        matchedAlias,
      }
    }
  }

  throw serviceError('REPORT_SOURCE_MANUAL_ASSET_MISMATCH', 422)
}

function buildStockSnapshot(stock: StockDetail) {
  const summaryDetail = stock.summaryDetail ?? null
  const keyStats = stock.defaultKeyStatistics ?? null
  const financialData = stock.financialData ?? null
  const historyRoot = {
    balanceSheetHistory: stock.balanceSheetHistory ?? null,
    incomeStatementHistory: stock.incomeStatementHistory ?? null,
    cashflowHistory: stock.cashflowHistory ?? null,
  }

  const payments = extractDividendPaymentsFromStock(stock)
  const regularMarketPrice = stock.regularMarketPrice ?? null
  const latestDividendValue =
    summaryDetail?.lastDividendValue ??
    keyStats?.lastDividendValue ??
    payments[0]?.value ??
    null

  const dividendYieldTtm = normalizeYieldPercent(
    summaryDetail?.dividendYield ?? keyStats?.trailingAnnualDividendYield,
  )

  const annualDividendPerShare =
    summaryDetail?.dividendRate ??
    keyStats?.trailingAnnualDividendRate ??
    (latestDividendValue != null && latestDividendValue > 0 ? latestDividendValue * 4 : null)

  const lastDividendYield =
    latestDividendValue != null && latestDividendValue > 0 &&
    regularMarketPrice != null && regularMarketPrice > 0
      ? (latestDividendValue / regularMarketPrice) * 100
      : null

  const dividendsIn2026 = payments
    .filter((payment) => payment.date?.startsWith('2026-'))
    .reduce((total, payment) => total + payment.value, 0)

  return {
    symbol: stock.symbol?.toUpperCase() ?? null,
    shortName: stock.shortName ?? null,
    longName: stock.longName ?? null,
    regularMarketPrice,
    regularMarketChangePercent: stock.regularMarketChangePercent ?? null,
    marketCap: stock.marketCap ?? null,
    priceEarnings: stock.priceEarnings ?? null,
    fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: stock.fiftyTwoWeekLow ?? null,
    summaryProfile: {
      sector: stock.summaryProfile?.sector ?? null,
      industry: stock.summaryProfile?.industry ?? null,
      website: stock.summaryProfile?.website ?? null,
    },
    summaryDetail: {
      dividendRate: summaryDetail?.dividendRate ?? null,
      dividendYield: summaryDetail?.dividendYield ?? null,
      lastDividendValue: summaryDetail?.lastDividendValue ?? null,
      exDividendDate: summaryDetail?.exDividendDate ?? null,
      dividendDate: summaryDetail?.dividendDate ?? null,
    },
    earningsPerShare: stock.earningsPerShare ?? keyStats?.trailingEps ?? null,
    financialData: {
      totalRevenue: financialData?.totalRevenue ?? null,
      ebitda: financialData?.ebitda ?? null,
      grossMargins: financialData?.grossMargins ?? null,
      operatingMargins: financialData?.operatingMargins ?? null,
      profitMargins: financialData?.profitMargins ?? null,
      revenueGrowth: financialData?.revenueGrowth ?? null,
      earningsGrowth: financialData?.earningsGrowth ?? null,
      returnOnEquity: financialData?.returnOnEquity ?? null,
      returnOnAssets: financialData?.returnOnAssets ?? null,
      totalDebt: financialData?.totalDebt ?? null,
      totalCash: financialData?.totalCash ?? null,
      currentRatio: financialData?.currentRatio ?? null,
      quickRatio: financialData?.quickRatio ?? null,
      debtToEquity: financialData?.debtToEquity ?? null,
      freeCashflow: financialData?.freeCashflow ?? null,
      operatingCashflow: financialData?.operatingCashflow ?? null,
    },
    defaultKeyStatistics: {
      beta: keyStats?.beta ?? null,
      bookValue: keyStats?.bookValue ?? null,
      pegRatio: keyStats?.pegRatio ?? null,
      priceToBook: keyStats?.priceToBook ?? null,
      enterpriseToEbitda: keyStats?.enterpriseToEbitda ?? null,
      enterpriseToRevenue: keyStats?.enterpriseToRevenue ?? null,
      trailingAnnualDividendRate: keyStats?.trailingAnnualDividendRate ?? null,
      trailingAnnualDividendYield: keyStats?.trailingAnnualDividendYield ?? null,
      lastDividendValue: keyStats?.lastDividendValue ?? null,
    },
    financialStatements: {
      totalAssets: findFirstNumberByKeys(historyRoot.balanceSheetHistory, ['totalAssets']),
      totalLiabilities: findFirstNumberByKeys(historyRoot.balanceSheetHistory, ['totalLiab', 'totalLiabilities']),
      shareholdersEquity: findFirstNumberByKeys(historyRoot.balanceSheetHistory, ['totalStockholderEquity', 'stockholdersEquity']),
      netIncome: findFirstNumberByKeys(historyRoot.incomeStatementHistory, ['netIncome', 'netIncomeApplicableToCommonShares']),
      revenue: findFirstNumberByKeys(historyRoot.incomeStatementHistory, ['totalRevenue']),
    },
    dividendHistory: {
      lastDividendValue: latestDividendValue,
      lastDividendYield,
      dividendYieldTtm,
      annualDividendPerShare,
      dividendsIn2026: dividendsIn2026 > 0 ? dividendsIn2026 : null,
      recentPayments: payments,
    },
  }
}

function formatSnapshotDate(value: string | null | undefined) {
  if (!value) {
    return '—'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function extractDividendPaymentsFromStock(stock: StockDetail) {
  const pending: unknown[] = [stock]
  const visited = new Set<unknown>()
  const payments: Array<{ date: string | null; value: number }> = []

  while (pending.length > 0) {
    const current = pending.shift()
    if (current == null || typeof current !== 'object') {
      continue
    }

    if (visited.has(current)) {
      continue
    }

    visited.add(current)

    if (Array.isArray(current)) {
      for (const entry of current) {
        if (entry != null && typeof entry === 'object' && !Array.isArray(entry)) {
          const maybeDate = findFirstStringByKeys(entry, ['paymentDate', 'date', 'dividendDate', 'exDividendDate'])
          const maybeValue = findFirstNumberByKeys(entry, ['cashAmount', 'dividend', 'value', 'amount'])
          if (maybeValue != null && maybeValue > 0) {
            payments.push({ date: maybeDate, value: maybeValue })
          }
        }

        if (entry != null && typeof entry === 'object') {
          pending.push(entry)
        }
      }
      continue
    }

    for (const value of Object.values(current)) {
      if (value != null && typeof value === 'object') {
        pending.push(value)
      }
    }
  }

  const deduped = new Map<string, { date: string | null; value: number }>()
  for (const payment of payments) {
    const key = `${payment.date ?? 'na'}:${payment.value.toFixed(6)}`
    if (!deduped.has(key)) {
      deduped.set(key, payment)
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => {
      const leftDate = left.date ? Date.parse(left.date) : Number.NEGATIVE_INFINITY
      const rightDate = right.date ? Date.parse(right.date) : Number.NEGATIVE_INFINITY
      return rightDate - leftDate
    })
    .slice(0, 8)
}

function findFirstStringByKeys(source: unknown, keys: string[]) {
  const pending: unknown[] = [source]
  const visited = new Set<unknown>()
  const keySet = new Set(keys.map((key) => key.toLowerCase()))

  while (pending.length > 0) {
    const current = pending.shift()
    if (current == null || typeof current !== 'object') {
      continue
    }

    if (visited.has(current)) {
      continue
    }

    visited.add(current)

    if (Array.isArray(current)) {
      for (const item of current) {
        pending.push(item)
      }
      continue
    }

    for (const [entryKey, entryValue] of Object.entries(current)) {
      if (keySet.has(entryKey.toLowerCase()) && typeof entryValue === 'string' && entryValue.trim()) {
        return entryValue
      }

      if (entryValue != null && typeof entryValue === 'object') {
        pending.push(entryValue)
      }
    }
  }

  return null
}

function buildStockPromptContext(snapshot: ReturnType<typeof buildStockSnapshot>) {
  const dividendPayments = snapshot.dividendHistory.recentPayments.length > 0
    ? snapshot.dividendHistory.recentPayments
        .slice(0, 5)
        .map((payment) => `  - ${formatSnapshotDate(payment.date)}: ${formatCurrency(payment.value)}`)
        .join('\n')
    : '  - —'

  return `Você é um analista buy and hold do mercado brasileiro.

Analise o ativo ${snapshot.symbol ?? '—'} (${snapshot.longName ?? snapshot.shortName ?? '—'}) a partir deste documento-base automático derivado de dados fundamentalistas confiáveis.

Documento-base:
- Preço: ${formatCurrency(snapshot.regularMarketPrice)}
- Variação do dia: ${snapshot.regularMarketChangePercent != null ? `${snapshot.regularMarketChangePercent.toFixed(2)}%` : '—'}
- Market cap: ${formatCurrency(snapshot.marketCap)}
- P/L: ${formatRatio(snapshot.priceEarnings)}
- P/VP: ${formatRatio(snapshot.defaultKeyStatistics.priceToBook)}
- EV/EBITDA: ${formatRatio(snapshot.defaultKeyStatistics.enterpriseToEbitda)}
- Receita: ${formatCurrency(snapshot.financialData.totalRevenue)}
- EBITDA: ${formatCurrency(snapshot.financialData.ebitda)}
- Fluxo de caixa livre: ${formatCurrency(snapshot.financialData.freeCashflow)}
- Crescimento de receita: ${snapshot.financialData.revenueGrowth != null ? `${(snapshot.financialData.revenueGrowth * 100).toFixed(2)}%` : '—'}
- Crescimento de lucro: ${snapshot.financialData.earningsGrowth != null ? `${(snapshot.financialData.earningsGrowth * 100).toFixed(2)}%` : '—'}
- Margem bruta: ${snapshot.financialData.grossMargins != null ? `${(snapshot.financialData.grossMargins * 100).toFixed(2)}%` : '—'}
- Margem líquida: ${snapshot.financialData.profitMargins != null ? `${(snapshot.financialData.profitMargins * 100).toFixed(2)}%` : '—'}
- ROE: ${snapshot.financialData.returnOnEquity != null ? `${(snapshot.financialData.returnOnEquity * 100).toFixed(2)}%` : '—'}
- ROA: ${snapshot.financialData.returnOnAssets != null ? `${(snapshot.financialData.returnOnAssets * 100).toFixed(2)}%` : '—'}
- Dívida total: ${formatCurrency(snapshot.financialData.totalDebt)}
- Caixa: ${formatCurrency(snapshot.financialData.totalCash)}
- Dív./PL: ${formatRatio(snapshot.financialData.debtToEquity)}
- Liquidez corrente: ${formatRatio(snapshot.financialData.currentRatio)}
- Setor: ${snapshot.summaryProfile.sector ?? '—'}
- Indústria: ${snapshot.summaryProfile.industry ?? '—'}

Indicadores adicionais:
- Margem EBIT: ${snapshot.financialData.operatingMargins != null ? `${(snapshot.financialData.operatingMargins * 100).toFixed(2)}%` : '—'}
- Liquidez seca: ${formatRatio(snapshot.financialData.quickRatio)}
- Crescimento de receita (5 anos): ${snapshot.financialData.revenueGrowth != null ? `${(snapshot.financialData.revenueGrowth * 100).toFixed(2)}%` : '—'}
- Crescimento de lucro (5 anos): ${snapshot.financialData.earningsGrowth != null ? `${(snapshot.financialData.earningsGrowth * 100).toFixed(2)}%` : '—'}

Demonstrações financeiras (último snapshot disponível):
- Receita líquida: ${formatCurrency(snapshot.financialStatements.revenue ?? snapshot.financialData.totalRevenue)}
- Lucro líquido: ${formatCurrency(snapshot.financialStatements.netIncome)}
- Ativos totais: ${formatCurrency(snapshot.financialStatements.totalAssets)}
- Passivos totais: ${formatCurrency(snapshot.financialStatements.totalLiabilities)}
- Patrimônio líquido: ${formatCurrency(snapshot.financialStatements.shareholdersEquity)}

Histórico de dividendos:
- Último dividendo: ${formatCurrency(snapshot.dividendHistory.lastDividendValue)}
- DY últ. dividendo: ${formatPercent(snapshot.dividendHistory.lastDividendYield)}
- Dividend Yield TTM: ${formatPercent(snapshot.dividendHistory.dividendYieldTtm)}
- Dividendos 2026: ${formatCurrency(snapshot.dividendHistory.dividendsIn2026)}
- Histórico de pagamentos (mais recentes):
${dividendPayments}

Responda em português do Brasil com exatamente 5 bullets, cada um começando com "•".
Cubra valuation, qualidade do negócio, riscos financeiros, leitura do momento e conclusão prática.`
}

function buildFiiSnapshot(fii: FiiItem) {
  return {
    papel: fii.papel.toUpperCase(),
    segmento: fii.segmento ?? null,
    cotacao: fii.cotacao ?? null,
    liquidez: fii.liquidez ?? null,
    dividendYield: fii.dividendYield ?? null,
    ffoYield: fii.ffoYield ?? null,
    pvp: fii.pvp ?? null,
    valorMercado: fii.valorMercado ?? null,
    qtdImoveis: fii.qtdImoveis ?? null,
    precoM2: fii.precoM2 ?? null,
    aluguelM2: fii.aluguelM2 ?? null,
    capRate: fii.capRate ?? null,
    vacanciaMedia: fii.vacanciaMedia ?? null,
  }
}

function buildFiiPromptContext(snapshot: ReturnType<typeof buildFiiSnapshot>) {
  return `Você é um analista de FIIs no mercado brasileiro.

Analise o FII ${snapshot.papel} usando este documento-base automático derivado de dados fundamentalistas.

Documento-base:
- Segmento: ${snapshot.segmento ?? '—'}
- Cotação: ${formatCurrency(snapshot.cotacao)}
- Liquidez diária: ${formatCurrency(snapshot.liquidez)}
- Dividend Yield: ${formatPercent(snapshot.dividendYield)}
- FFO Yield: ${formatPercent(snapshot.ffoYield)}
- P/VP: ${formatRatio(snapshot.pvp)}
- Valor de mercado: ${formatCurrency(snapshot.valorMercado)}
- Quantidade de imóveis: ${snapshot.qtdImoveis ?? '—'}
- Preço por m²: ${formatCurrency(snapshot.precoM2)}
- Aluguel por m²: ${formatCurrency(snapshot.aluguelM2)}
- Cap rate: ${formatPercent(snapshot.capRate)}
- Vacância média: ${formatPercent(snapshot.vacanciaMedia)}

Responda em português do Brasil com exatamente 5 bullets, cada um começando com "•".
Cubra renda, valuation, qualidade do portfólio, riscos e conclusão prática.`
}

async function getUserReportPricing(userId: string, reportMode: ReportMode) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { plan: { select: { name: true } } },
  })

  const plan = user.plan?.name ?? PlanType.FREE
  const amount = REPORT_PRICE_BY_MODE[reportMode][plan]
  return { plan, amount }
}

async function getOrCreateBalance(userId: string, tx: Prisma.TransactionClient) {
  const balance = await tx.userCreditBalance.findUnique({ where: { userId } })
  if (balance) {
    return balance
  }

  return tx.userCreditBalance.create({
    data: { userId, balance: new Prisma.Decimal(0) },
  })
}

async function debitCreditsAndGrantAccess(input: {
  userId: string
  analysisId: string
  amount: number
  description: string
  metadata?: JsonValue
  accessTtlDays?: number
  accessExpiresAt?: Date
  now: Date
}) {
  return prisma.$transaction(async (tx) => {
    const balance = await getOrCreateBalance(input.userId, tx)
    const debitAmount = new Prisma.Decimal(input.amount)

    if (new Prisma.Decimal(balance.balance).lt(debitAmount)) {
      throw serviceError('INSUFFICIENT_CREDITS', 409)
    }

    const nextBalance = new Prisma.Decimal(balance.balance).sub(debitAmount)
    const updatedBalance = await tx.userCreditBalance.update({
      where: { userId: input.userId },
      data: { balance: nextBalance },
    })

    await tx.creditLedgerEntry.create({
      data: {
        userId: input.userId,
        kind: CreditLedgerEntryKind.DEBIT,
        amount: debitAmount,
        balanceAfter: nextBalance,
        description: input.description,
        metadata: input.metadata,
      },
    })

    const ttlDays = input.accessTtlDays ?? REPORT_ACCESS_TTL_DAYS
    const expiresAt = input.accessExpiresAt ?? new Date(input.now.getTime() + ttlDays * 24 * 60 * 60 * 1000)

    const access = await tx.userAssetReportAccess.upsert({
      where: {
        userId_analysisId: {
          userId: input.userId,
          analysisId: input.analysisId,
        },
      },
      update: { expiresAt },
      create: {
        userId: input.userId,
        analysisId: input.analysisId,
        expiresAt,
      },
      include: {
        analysis: {
          include: { source: true },
        },
      },
    })

    return { balance: updatedBalance, access }
  })
}

async function createAnalysisFromResolvedSource(input: {
  userId: string
  assetType: AssetReportAssetType
  ticker: string
  reportMode: ReportMode
  monthKey: string
  validUntil: Date
  amount: number
  plan: PlanType
  now: Date
  resolvedSource: ResolvedReportSource
  generateAnalysis: NonNullable<ReportRuntime['generateAnalysis']>
  buildValuationAppendix: NonNullable<ReportRuntime['buildValuationAppendix']>
}) {
  const source = await upsertAssetReportSource({
    assetType: input.assetType,
    ticker: input.ticker,
    reportMode: input.reportMode,
    monthKey: input.monthKey,
    sourceKind: input.resolvedSource.sourceKind,
    sourceUrl: input.resolvedSource.sourceUrl,
    storageKey: input.resolvedSource.storageKey,
    originalFileName: input.resolvedSource.originalFileName,
    documentFingerprint: input.resolvedSource.documentFingerprint,
    metadata: input.resolvedSource.metadata,
  })

  const baseAnalysisText = await input.generateAnalysis({
    assetType: input.assetType,
    ticker: input.ticker,
    promptContext: input.resolvedSource.promptContext,
  })

  const valuationAppendix = await input.buildValuationAppendix({
    assetType: input.assetType,
    ticker: input.ticker,
  })
  const analysisText = appendValuationAppendix(baseAnalysisText, valuationAppendix)

  const analysis = await upsertAssetReportAnalysis({
    assetType: input.assetType,
    ticker: input.ticker,
    reportMode: input.reportMode,
    monthKey: input.monthKey,
    sourceId: source.id,
    analysisText,
    model: process.env.NODE_ENV === 'test' ? 'gpt-4o-mini-test' : 'gpt-4o-mini',
    validUntil: input.validUntil,
    metadata: {
      reportMode: input.reportMode,
      monthKey: input.monthKey,
      sourceKind: input.resolvedSource.sourceKind,
      autoFound: input.resolvedSource.sourceKind === AssetReportSourceKind.AUTO_FOUND,
      manualUpload: input.resolvedSource.sourceKind === AssetReportSourceKind.MANUAL_UPLOAD,
    },
  })

  const charged = await debitCreditsAndGrantAccess({
    userId: input.userId,
    analysisId: analysis.id,
    amount: input.amount,
    description: `Análise on-demand de ${input.ticker}`,
    metadata: {
      assetType: input.assetType,
      ticker: input.ticker,
      reportMode: input.reportMode,
      monthKey: input.monthKey,
      reuse: false,
      sourceKind: input.resolvedSource.sourceKind,
    },
    accessExpiresAt: input.validUntil,
    now: input.now,
  })

  return {
    outcome: 'GENERATED' as const,
    chargedAmount: decimalToString(input.amount),
    plan: input.plan,
    balance: charged.balance,
    access: charged.access,
    analysis,
  }
}

async function chargeAndGrantFromReusableAnalysis(input: {
  userId: string
  assetType: AssetReportAssetType
  ticker: string
  reportMode: ReportMode
  monthKey: string
  amount: number
  plan: PlanType
  now: Date
}) {
  const reusable = await findReusableAssetReportAnalysis({
    assetType: input.assetType,
    ticker: input.ticker,
    reportMode: input.reportMode,
    monthKey: input.monthKey,
    now: input.now,
  })

  if (!reusable) {
    return null
  }

  const charged = await debitCreditsAndGrantAccess({
    userId: input.userId,
    analysisId: reusable.id,
    amount: input.amount,
    description: `Desbloqueio de análise reaproveitada de ${input.ticker}`,
    metadata: {
      assetType: input.assetType,
      ticker: input.ticker,
      reportMode: input.reportMode,
      monthKey: input.monthKey,
      reuse: true,
      sourceKind: reusable.source.sourceKind,
    },
    accessExpiresAt: reusable.validUntil,
    now: input.now,
  })

  return {
    outcome: 'REUSED' as const,
    chargedAmount: decimalToString(input.amount),
    plan: input.plan,
    balance: charged.balance,
    access: charged.access,
    analysis: reusable,
  }
}

export async function createOnDemandReportAnalysis(
  input: {
    userId: string
    assetType: AssetReportAssetType
    ticker: string
  },
  runtime: ReportRuntime = {},
) {
  const now = runtime.now?.() ?? new Date()
  const ticker = normalizeTicker(input.ticker)
  const reportMode = ReportMode.BRAPI_TICKER
  const monthKey = toMonthKey(now)
  const validUntil = resolveCurrentMonthValidityEnd(now)
  const { amount, plan } = await getUserReportPricing(input.userId, reportMode)

  const activeAccess = await findActiveAssetReportAccess({
    userId: input.userId,
    assetType: input.assetType,
    ticker,
    reportMode,
    monthKey,
    now,
  })

  if (activeAccess) {
    appLogger.info('report-cache-active-access', { userId: input.userId, ticker, reportMode, monthKey })
    const balance = await getCreditBalance(input.userId)
    return {
      outcome: 'ACTIVE_ACCESS' as const,
      chargedAmount: decimalToString(0),
      plan,
      balance,
      access: activeAccess,
      analysis: activeAccess.analysis,
    }
  }

  const reusable = await chargeAndGrantFromReusableAnalysis({
    userId: input.userId,
    assetType: input.assetType,
    ticker,
    reportMode,
    monthKey,
    amount,
    plan,
    now,
  })

  if (reusable) {
    appLogger.info('report-cache-hit', { userId: input.userId, ticker, reportMode, monthKey })
    return reusable
  }

  appLogger.info('report-cache-miss', { userId: input.userId, ticker, reportMode, monthKey })
  const resolveAutoSource = runtime.resolveAutoSource ?? ((sourceInput: {
    assetType: AssetReportAssetType
    ticker: string
  }) => defaultResolveAutoSource(sourceInput))
  const resolvedSource = await resolveAutoSource({
    assetType: input.assetType,
    ticker,
  })

  if (!resolvedSource) {
    throw serviceError('REPORT_SOURCE_NOT_FOUND', 404)
  }
  const generateAnalysis = runtime.generateAnalysis ?? defaultGenerateAnalysis
  const buildValuationAppendix = runtime.buildValuationAppendix ?? defaultBuildValuationAppendix
  return createAnalysisFromResolvedSource({
    userId: input.userId,
    assetType: input.assetType,
    ticker,
    reportMode,
    monthKey,
    validUntil,
    amount,
    plan,
    now,
    resolvedSource,
    generateAnalysis,
    buildValuationAppendix,
  })
}

export async function createManualReportAnalysis(
  input: {
    userId: string
    assetType: AssetReportAssetType
    ticker: string
    originalFileName: string
    contentType?: string
    fileBase64?: string
    storageKey?: string
  },
  runtime: ReportRuntime = {},
) {
  const now = runtime.now?.() ?? new Date()
  const ticker = normalizeTicker(input.ticker)
  const reportMode = ReportMode.RI_UPLOAD_AI
  const monthKey = toMonthKey(now)
  const validUntil = resolveCurrentMonthValidityEnd(now)
  const { amount, plan } = await getUserReportPricing(input.userId, reportMode)

  const activeAccess = await findActiveAssetReportAccess({
    userId: input.userId,
    assetType: input.assetType,
    ticker,
    reportMode,
    monthKey,
    now,
  })

  if (activeAccess) {
    appLogger.info('report-cache-active-access', { userId: input.userId, ticker, reportMode, monthKey })
    const balance = await getCreditBalance(input.userId)
    return {
      outcome: 'ACTIVE_ACCESS' as const,
      chargedAmount: decimalToString(0),
      plan,
      balance,
      access: activeAccess,
      analysis: activeAccess.analysis,
    }
  }

  const reusable = await chargeAndGrantFromReusableAnalysis({
    userId: input.userId,
    assetType: input.assetType,
    ticker,
    reportMode,
    monthKey,
    amount,
    plan,
    now,
  })

  if (reusable) {
    appLogger.info('report-cache-hit', { userId: input.userId, ticker, reportMode, monthKey })
    return reusable
  }

  appLogger.info('report-cache-miss', { userId: input.userId, ticker, reportMode, monthKey })
  const manualUpload = await resolveManualUploadBuffer({
    fileBase64: input.fileBase64,
    storageKey: input.storageKey,
  })
  const storedUpload = input.storageKey
    ? null
    : await storeManualUploadObject({
        assetType: input.assetType,
        ticker,
        originalFileName: input.originalFileName,
        contentType: input.contentType,
        fileBase64: input.fileBase64!,
      })
  const extracted = await extractManualUploadText({
    originalFileName: input.originalFileName,
    contentType: input.contentType,
    buffer: manualUpload.buffer,
  })
  const validation = await validateManualReportBelongsToAsset({
    assetType: input.assetType,
    ticker,
    documentText: extracted.text,
  })
  const resolvedSource: ResolvedReportSource = {
    assetType: input.assetType,
    ticker,
    sourceKind: AssetReportSourceKind.MANUAL_UPLOAD,
    sourceUrl: null,
    storageKey: input.storageKey ?? storedUpload?.storageKey ?? manualUpload.storageKey,
    originalFileName: input.originalFileName,
    documentFingerprint: hashText(normalizeManualText(extracted.text)),
    metadata: {
      upload: {
        originalFileName: input.originalFileName,
        contentType: input.contentType ?? null,
        fileSizeBytes: extracted.fileSizeBytes,
      },
      validation,
    },
    promptContext: buildManualPromptContext({
      assetType: input.assetType,
      ticker,
      originalFileName: input.originalFileName,
      documentText: extracted.text,
    }),
  }

  const generateAnalysis = runtime.generateAnalysis ?? defaultGenerateAnalysis
  const buildValuationAppendix = runtime.buildValuationAppendix ?? defaultBuildValuationAppendix
  return createAnalysisFromResolvedSource({
    userId: input.userId,
    assetType: input.assetType,
    ticker,
    reportMode,
    monthKey,
    validUntil,
    amount,
    plan,
    now,
    resolvedSource,
    generateAnalysis,
    buildValuationAppendix,
  })
}

export async function getUserAccessibleReportAnalysis(input: {
  userId: string
  analysisId: string
  now?: Date
}) {
  const now = input.now ?? new Date()

  return prisma.userAssetReportAccess.findFirst({
    where: {
      userId: input.userId,
      analysisId: input.analysisId,
      expiresAt: { gt: now },
    },
    include: {
      analysis: {
        include: {
          source: true,
        },
      },
    },
  })
}
