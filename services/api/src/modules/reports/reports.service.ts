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
} from '@prisma/client'
import { getObject, putObject } from '../../lib/object-storage'
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

const REPORT_PRICE_BY_PLAN: Record<PlanType, number> = {
  FREE: 2.5,
  PREMIUM: 1.5,
}

const REPORT_ACCESS_TTL_DAYS = 30
const REPORT_ANALYSIS_TTL_DAYS = 30
const MANUAL_UPLOAD_MAX_BYTES = 5 * 1024 * 1024
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
  now?: () => Date
}

function serviceError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode })
}

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase()
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
  const assetLabel = input.assetType === AssetReportAssetType.FII ? 'FII brasileiro' : 'acao brasileira listada na B3'

  return [
    'Encontre uma fonte publica confiavel e recente para analise fundamentalista do ativo abaixo.',
    `Ticker: ${input.ticker}`,
    `Tipo: ${assetLabel}`,
    'Responda apenas em JSON valido sem markdown.',
    'Campos esperados:',
    '{',
    '  "found": boolean,',
    '  "sourceUrl": string | null,',
    '  "title": string | null,',
    '  "summary": string | null,',
    '  "publisher": string | null',
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
  }

  if (!parsed.found || !parsed.sourceUrl || !parsed.summary) {
    return null
  }

  return {
    sourceUrl: parsed.sourceUrl,
    title: parsed.title ?? null,
    summary: parsed.summary,
    publisher: parsed.publisher ?? null,
  }
}

async function defaultResolveWebSearchSource(input: {
  assetType: AssetReportAssetType
  ticker: string
}): Promise<ResolvedReportSource | null> {
  if (process.env.REPORT_AUTO_WEB_SEARCH_ENABLED !== 'true') {
    return null
  }

  if (!process.env.OPENAI_API_KEY) {
    return null
  }

  const responsesApi = (openai as unknown as {
    responses?: {
      create: (input: Record<string, unknown>) => Promise<{ output_text?: string }>
    }
  }).responses

  if (!responsesApi) {
    return null
  }

  const response = await responsesApi.create({
    model: process.env.OPENAI_WEB_SEARCH_MODEL ?? 'gpt-4.1-mini',
    tools: [{ type: 'web_search_preview' }],
    input: buildWebSearchPrompt(input),
  })

  const outputText = response.output_text?.trim()
  if (!outputText) {
    return null
  }

  let result: ReturnType<typeof parseWebSearchResult>
  try {
    result = parseWebSearchResult(outputText)
  } catch {
    return null
  }

  if (!result) {
    return null
  }

  const promptContext = [
    `Voce e um analista buy and hold do mercado brasileiro.`,
    `Analise o ativo ${input.ticker} usando este resumo de fonte publica encontrada via busca web controlada.`,
    `Fonte: ${result.title ?? 'Fonte publica'}${result.publisher ? ` (${result.publisher})` : ''}`,
    `URL: ${result.sourceUrl}`,
    '',
    'Resumo util da fonte:',
    result.summary,
    '',
    'Responda em portugues do Brasil com exatamente 5 bullets, cada um comecando com "•".',
    'Cubra qualidade do ativo, riscos, leitura do momento e conclusao pratica.',
  ].join('\n')

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
      discoveryMethod: 'OPENAI_WEB_SEARCH',
    }),
    metadata: {
      discoveryMethod: 'OPENAI_WEB_SEARCH',
      title: result.title,
      publisher: result.publisher,
      summary: result.summary,
    },
    promptContext,
  }
}

async function defaultResolveAutoSource(input: {
  assetType: AssetReportAssetType
  ticker: string
}, resolveWebSearchSource?: ReportRuntime['resolveWebSearchSource']): Promise<ResolvedReportSource | null> {
  const ticker = normalizeTicker(input.ticker)

  const localSource = input.assetType === AssetReportAssetType.STOCK
    ? await resolveStockAutoSource(ticker)
    : await resolveFiiAutoSource(ticker)

  if (localSource) {
    return localSource
  }

  const webSearchResolver = resolveWebSearchSource ?? defaultResolveWebSearchSource
  return webSearchResolver({
    assetType: input.assetType,
    ticker,
  })
}

async function defaultGenerateAnalysis(input: {
  assetType: AssetReportAssetType
  ticker: string
  promptContext: string
}) {
  if (process.env.NODE_ENV === 'test') {
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
  return {
    symbol: stock.symbol?.toUpperCase() ?? null,
    shortName: stock.shortName ?? null,
    longName: stock.longName ?? null,
    regularMarketPrice: stock.regularMarketPrice ?? null,
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
    financialData: {
      totalRevenue: stock.financialData?.totalRevenue ?? null,
      ebitda: stock.financialData?.ebitda ?? null,
      grossMargins: stock.financialData?.grossMargins ?? null,
      profitMargins: stock.financialData?.profitMargins ?? null,
      revenueGrowth: stock.financialData?.revenueGrowth ?? null,
      earningsGrowth: stock.financialData?.earningsGrowth ?? null,
      returnOnEquity: stock.financialData?.returnOnEquity ?? null,
      returnOnAssets: stock.financialData?.returnOnAssets ?? null,
      totalDebt: stock.financialData?.totalDebt ?? null,
      totalCash: stock.financialData?.totalCash ?? null,
      currentRatio: stock.financialData?.currentRatio ?? null,
      quickRatio: stock.financialData?.quickRatio ?? null,
      debtToEquity: stock.financialData?.debtToEquity ?? null,
      freeCashflow: stock.financialData?.freeCashflow ?? null,
      operatingCashflow: stock.financialData?.operatingCashflow ?? null,
    },
    defaultKeyStatistics: {
      beta: stock.defaultKeyStatistics?.beta ?? null,
      pegRatio: stock.defaultKeyStatistics?.pegRatio ?? null,
      priceToBook: stock.defaultKeyStatistics?.priceToBook ?? null,
      enterpriseToEbitda: stock.defaultKeyStatistics?.enterpriseToEbitda ?? null,
      enterpriseToRevenue: stock.defaultKeyStatistics?.enterpriseToRevenue ?? null,
    },
  }
}

function buildStockPromptContext(snapshot: ReturnType<typeof buildStockSnapshot>) {
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

async function getUserReportPricing(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { plan: { select: { name: true } } },
  })

  const plan = user.plan?.name ?? PlanType.FREE
  const amount = REPORT_PRICE_BY_PLAN[plan]
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
    const expiresAt = new Date(input.now.getTime() + ttlDays * 24 * 60 * 60 * 1000)

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
  amount: number
  plan: PlanType
  now: Date
  resolvedSource: ResolvedReportSource
  generateAnalysis: NonNullable<ReportRuntime['generateAnalysis']>
}) {
  const source = await upsertAssetReportSource({
    assetType: input.assetType,
    ticker: input.ticker,
    sourceKind: input.resolvedSource.sourceKind,
    sourceUrl: input.resolvedSource.sourceUrl,
    storageKey: input.resolvedSource.storageKey,
    originalFileName: input.resolvedSource.originalFileName,
    documentFingerprint: input.resolvedSource.documentFingerprint,
    metadata: input.resolvedSource.metadata,
  })

  const reusable = await findReusableAssetReportAnalysis({
    assetType: input.assetType,
    ticker: input.ticker,
    documentFingerprint: input.resolvedSource.documentFingerprint,
    now: input.now,
  })

  if (reusable) {
    const charged = await debitCreditsAndGrantAccess({
      userId: input.userId,
      analysisId: reusable.id,
      amount: input.amount,
      description: `Desbloqueio de análise reaproveitada de ${input.ticker}`,
      metadata: {
        assetType: input.assetType,
        ticker: input.ticker,
        reuse: true,
        sourceKind: input.resolvedSource.sourceKind,
      },
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

  const analysisText = await input.generateAnalysis({
    assetType: input.assetType,
    ticker: input.ticker,
    promptContext: input.resolvedSource.promptContext,
  })

  const analysis = await upsertAssetReportAnalysis({
    assetType: input.assetType,
    ticker: input.ticker,
    sourceId: source.id,
    analysisText,
    model: process.env.NODE_ENV === 'test' ? 'gpt-4o-mini-test' : 'gpt-4o-mini',
    validUntil: new Date(input.now.getTime() + REPORT_ANALYSIS_TTL_DAYS * 24 * 60 * 60 * 1000),
    metadata: {
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
      reuse: false,
      sourceKind: input.resolvedSource.sourceKind,
    },
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
  const { amount, plan } = await getUserReportPricing(input.userId)

  const activeAccess = await findActiveAssetReportAccess({
    userId: input.userId,
    assetType: input.assetType,
    ticker,
    now,
  })

  if (activeAccess) {
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

  const resolveAutoSource = runtime.resolveAutoSource ?? ((sourceInput: {
    assetType: AssetReportAssetType
    ticker: string
  }) => defaultResolveAutoSource(sourceInput, runtime.resolveWebSearchSource))
  const resolvedSource = await resolveAutoSource({
    assetType: input.assetType,
    ticker,
  })

  if (!resolvedSource) {
    throw serviceError('REPORT_SOURCE_NOT_FOUND', 404)
  }
  const generateAnalysis = runtime.generateAnalysis ?? defaultGenerateAnalysis
  return createAnalysisFromResolvedSource({
    userId: input.userId,
    assetType: input.assetType,
    ticker,
    amount,
    plan,
    now,
    resolvedSource,
    generateAnalysis,
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
  const { amount, plan } = await getUserReportPricing(input.userId)

  const activeAccess = await findActiveAssetReportAccess({
    userId: input.userId,
    assetType: input.assetType,
    ticker,
    now,
  })

  if (activeAccess) {
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
  return createAnalysisFromResolvedSource({
    userId: input.userId,
    assetType: input.assetType,
    ticker,
    amount,
    plan,
    now,
    resolvedSource,
    generateAnalysis,
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
