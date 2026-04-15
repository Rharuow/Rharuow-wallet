import assert from 'node:assert/strict'
import { AssetReportAssetType, PlanType, Prisma } from '@prisma/client'
import { after, beforeEach, test } from 'node:test'
import { prisma } from '../lib/prisma'
import {
  createCreditTopupOrder,
  getCreditBalance,
  listCreditLedger,
  markCreditTopupOrderPaid,
} from '../modules/credits/credits.service'
import {
  createManualReportAnalysis,
  createOnDemandReportAnalysis,
  mergeResolvedReportSourceWithStructuredFallback,
} from '../modules/reports/reports.service'
import {
  cleanupTestData,
  createTestUser,
  updateUserPlan,
} from './testUtils'

beforeEach(async () => {
  await cleanupTestData()
})

after(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
  setImmediate(() => process.exit(process.exitCode ?? 0))
})

async function seedCredits(userId: string, amount: number, suffix: string) {
  const order = await createCreditTopupOrder({
    userId,
    amount,
    stripeCheckoutSessionId: `cs_test_reports_${suffix}`,
  })

  await markCreditTopupOrderPaid({
    orderId: order.id,
    stripePaymentIntentId: `pi_test_reports_${suffix}`,
  })
}

test('reports-on-demand.spec: gera análise, debita créditos e evita nova cobrança com acesso ativo', async () => {
  const user = await createTestUser({ name: 'Report Buyer', plan: PlanType.FREE })
  await seedCredits(user.id, 5, 'buyer')

  let generateCalls = 0
  const runtime = {
    resolveAutoSource: async () => ({
      assetType: AssetReportAssetType.STOCK,
      ticker: 'PETR4',
      sourceKind: 'AUTO_FOUND' as const,
      sourceUrl: 'https://example.com/petr4-report',
      documentFingerprint: 'fp-petr4-v1',
      metadata: { provider: 'test' },
      promptContext: 'context',
    }),
    generateAnalysis: async () => {
      generateCalls += 1
      return '• ponto 1\n• ponto 2\n• ponto 3\n• ponto 4\n• ponto 5'
    },
    now: () => new Date('2026-04-04T12:00:00.000Z'),
  }

  const first = await createOnDemandReportAnalysis({
    userId: user.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'PETR4',
  }, runtime)

  assert.equal(first.outcome, 'GENERATED')
  assert.equal(first.chargedAmount, '2.5')
  assert.equal(generateCalls, 1)

  const firstBalance = await getCreditBalance(user.id)
  assert.equal(new Prisma.Decimal(firstBalance.balance).toFixed(2), '2.50')

  const second = await createOnDemandReportAnalysis({
    userId: user.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'PETR4',
  }, runtime)

  assert.equal(second.outcome, 'ACTIVE_ACCESS')
  assert.equal(second.chargedAmount, '0')
  assert.equal(generateCalls, 1)

  const ledger = await listCreditLedger(user.id)
  assert.equal(ledger.filter((entry) => entry.kind === 'DEBIT').length, 1)
})

test('reports-on-demand.spec: reaproveita análise existente e cobra preço do plano premium', async () => {
  const author = await createTestUser({ name: 'Author User', plan: PlanType.FREE })
  const premium = await createTestUser({ name: 'Premium User', plan: PlanType.FREE })

  await updateUserPlan(premium.id, PlanType.PREMIUM)
  await seedCredits(author.id, 5, 'author')
  await seedCredits(premium.id, 5, 'premium')

  let generateCalls = 0
  const runtime = {
    resolveAutoSource: async () => ({
      assetType: AssetReportAssetType.FII,
      ticker: 'MXRF11',
      sourceKind: 'AUTO_FOUND' as const,
      sourceUrl: 'https://example.com/mxrf11-report',
      documentFingerprint: 'fp-mxrf11-v1',
      metadata: { provider: 'test' },
      promptContext: 'context',
    }),
    generateAnalysis: async () => {
      generateCalls += 1
      return '• análise A\n• análise B\n• análise C\n• análise D\n• análise E'
    },
    now: () => new Date('2026-04-04T12:00:00.000Z'),
  }

  const generated = await createOnDemandReportAnalysis({
    userId: author.id,
    assetType: AssetReportAssetType.FII,
    ticker: 'MXRF11',
  }, runtime)

  assert.equal(generated.outcome, 'GENERATED')
  assert.equal(generateCalls, 1)

  const reused = await createOnDemandReportAnalysis({
    userId: premium.id,
    assetType: AssetReportAssetType.FII,
    ticker: 'MXRF11',
  }, runtime)

  assert.equal(reused.outcome, 'REUSED')
  assert.equal(reused.chargedAmount, '1.5')
  assert.equal(generateCalls, 1)

  const balance = await getCreditBalance(premium.id)
  assert.equal(new Prisma.Decimal(balance.balance).toFixed(2), '3.50')
})

test('reports-on-demand.spec: não cobra quando o relatório não é encontrado ou a análise falha', async () => {
  const user = await createTestUser({ name: 'No Charge User', plan: PlanType.FREE })
  await seedCredits(user.id, 5, 'no-charge')

  await assert.rejects(
    () => createOnDemandReportAnalysis({
      userId: user.id,
      assetType: AssetReportAssetType.STOCK,
      ticker: 'XXXX4',
    }, {
      resolveAutoSource: async () => null,
    }),
    (error: unknown) => {
      const err = error as Error & { statusCode?: number }
      assert.equal(err.message, 'REPORT_SOURCE_NOT_FOUND')
      assert.equal(err.statusCode, 404)
      return true
    },
  )

  await assert.rejects(
    () => createOnDemandReportAnalysis({
      userId: user.id,
      assetType: AssetReportAssetType.STOCK,
      ticker: 'VALE3',
    }, {
      resolveAutoSource: async () => ({
        assetType: AssetReportAssetType.STOCK,
        ticker: 'VALE3',
        sourceKind: 'AUTO_FOUND' as const,
        sourceUrl: 'https://example.com/vale3-report',
        documentFingerprint: 'fp-vale3-v1',
        metadata: { provider: 'test' },
        promptContext: 'context',
      }),
      generateAnalysis: async () => {
        throw Object.assign(new Error('REPORT_ANALYSIS_UPSTREAM_FAILURE'), { statusCode: 502 })
      },
    }),
    (error: unknown) => {
      const err = error as Error & { statusCode?: number }
      assert.equal(err.message, 'REPORT_ANALYSIS_UPSTREAM_FAILURE')
      assert.equal(err.statusCode, 502)
      return true
    },
  )

  const balance = await getCreditBalance(user.id)
  assert.equal(new Prisma.Decimal(balance.balance).toFixed(2), '5.00')

  const ledger = await listCreditLedger(user.id)
  assert.equal(ledger.filter((entry) => entry.kind === 'DEBIT').length, 0)
})

test('reports-on-demand.spec: usa fonte estruturada BRAPI como origem principal no modo ticker', async () => {
  const user = await createTestUser({ name: 'Brapi Source User', plan: PlanType.FREE })
  await seedCredits(user.id, 5, 'brapi-source')
  const ticker = 'PETR4'

  const result = await createOnDemandReportAnalysis({
    userId: user.id,
    assetType: AssetReportAssetType.STOCK,
    ticker,
  }, {
    resolveAutoSource: async () => ({
      assetType: AssetReportAssetType.STOCK,
      ticker,
      sourceKind: 'AUTO_FOUND' as const,
      sourceUrl: `https://brapi.dev/quote/${ticker}`,
      documentFingerprint: 'fp-petr4-brapi-v1',
      metadata: {
        provider: 'BRAPI',
        symbol: ticker,
      },
      promptContext: 'Dados estruturados BRAPI para PETR4.',
    }),
    generateAnalysis: async () => '• web 1\n• web 2\n• web 3\n• web 4\n• web 5',
    now: () => new Date('2026-04-04T12:00:00.000Z'),
  })

  assert.equal(result.outcome, 'GENERATED')
  assert.equal(result.chargedAmount, '2.5')
  assert.equal(result.analysis.source.sourceUrl, 'https://brapi.dev/quote/PETR4')
  const metadata = result.analysis.source.metadata as { provider?: string; symbol?: string } | null
  assert.equal(metadata?.provider, 'BRAPI')
  assert.equal(metadata?.symbol, 'PETR4')
})

test('reports-on-demand.spec: anexa apêndice de valuation com Graham e Bazin ao texto final', async () => {
  const user = await createTestUser({ name: 'Valuation User', plan: PlanType.FREE })
  await seedCredits(user.id, 5, 'valuation')

  const result = await createOnDemandReportAnalysis({
    userId: user.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'WEG3',
  }, {
    resolveAutoSource: async () => ({
      assetType: AssetReportAssetType.STOCK,
      ticker: 'WEG3',
      sourceKind: 'AUTO_FOUND' as const,
      sourceUrl: 'https://ri.example.com/weg3-release.pdf',
      documentFingerprint: 'fp-weg3-v1',
      metadata: { provider: 'test' },
      promptContext: 'context',
    }),
    generateAnalysis: async () => '• leitura 1\n• leitura 2\n• leitura 3\n• leitura 4\n• leitura 5',
    buildValuationAppendix: async () => ([
      'Fórmula de Graham: preço justo estimado em R$ 42,10.',
      'Fórmula de Bazin: preço justo estimado em R$ 37,80.',
    ]),
    now: () => new Date('2026-04-04T12:00:00.000Z'),
  })

  assert.match(result.analysis.analysisText, /Fórmula de Graham: preço justo estimado em R\$ 42,10\./)
  assert.match(result.analysis.analysisText, /Fórmula de Bazin: preço justo estimado em R\$ 37,80\./)
})

test('reports-on-demand.spec: combina RI oficial com dados estruturados de fallback no prompt final', () => {
  const merged = mergeResolvedReportSourceWithStructuredFallback(
    {
      assetType: AssetReportAssetType.STOCK,
      ticker: 'PETR4',
      sourceKind: 'AUTO_FOUND' as const,
      sourceUrl: 'https://ri.example.com/petr4-release.pdf',
      documentFingerprint: 'official-fingerprint',
      metadata: {
        discoveryMethod: 'OFFICIAL_IR_WEB_SEARCH',
        title: 'Release oficial',
      },
      promptContext: 'Resumo oficial de RI com foco qualitativo.',
    },
    {
      assetType: AssetReportAssetType.STOCK,
      ticker: 'PETR4',
      sourceKind: 'AUTO_FOUND' as const,
      sourceUrl: 'https://brapi.dev/quote/PETR4',
      documentFingerprint: 'structured-fingerprint',
      metadata: {
        provider: 'BRAPI',
      },
      promptContext: 'Documento-base:\n- P/L: 4.20\n- Receita: R$ 10,00\n- EBITDA: R$ 8,00',
    },
  )

  assert.equal(merged.sourceUrl, 'https://ri.example.com/petr4-release.pdf')
  assert.notEqual(merged.documentFingerprint, 'official-fingerprint')
  assert.match(merged.promptContext, /Resumo oficial de RI com foco qualitativo\./)
  assert.match(merged.promptContext, /Dados estruturados complementares do BRAPI/)
  assert.match(merged.promptContext, /P\/L: 4\.20/)

  const metadata = merged.metadata as {
    supplementalSource?: {
      provider?: string
      sourceUrl?: string | null
    }
  }

  assert.equal(metadata.supplementalSource?.provider, 'BRAPI')
  assert.equal(metadata.supplementalSource?.sourceUrl, 'https://brapi.dev/quote/PETR4')
})

test('reports-on-demand.spec: upload manual gera análise, reaproveita fingerprint e não cobra arquivo inválido', async () => {
  const freeUser = await createTestUser({ name: 'Manual Free', plan: PlanType.FREE })
  const premiumUser = await createTestUser({ name: 'Manual Premium', plan: PlanType.PREMIUM })
  await seedCredits(freeUser.id, 6, 'manual-free')
  await seedCredits(premiumUser.id, 6, 'manual-premium')

  let generateCalls = 0
  const runtime = {
    generateAnalysis: async () => {
      generateCalls += 1
      return '• manual 1\n• manual 2\n• manual 3\n• manual 4\n• manual 5'
    },
    now: () => new Date('2026-04-04T12:00:00.000Z'),
  }
  const manualBase64 = Buffer.from(
    'Relatorio fundamentalista da companhia ABCD4. Receita crescendo acima de 12% ao ano, margem estavel, endividamento controlado e guidance operacional conservador para os proximos trimestres. Riscos citados: dependencia de commodity, volatilidade cambial e ciclo de investimento ainda pressionando o caixa no curto prazo.',
    'utf8',
  ).toString('base64')

  const generated = await createManualReportAnalysis({
    userId: freeUser.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'ABCD4',
    originalFileName: 'abcd4-relatorio.txt',
    contentType: 'text/plain',
    fileBase64: manualBase64,
  }, runtime)

  assert.equal(generated.outcome, 'GENERATED')
  assert.equal(generated.analysis.source.sourceKind, 'MANUAL_UPLOAD')
  assert.equal(generated.analysis.source.originalFileName, 'abcd4-relatorio.txt')
  assert.equal(generated.chargedAmount, '4')

  const reused = await createManualReportAnalysis({
    userId: premiumUser.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'ABCD4',
    originalFileName: 'abcd4-relatorio.txt',
    contentType: 'text/plain',
    fileBase64: manualBase64,
  }, runtime)

  assert.equal(reused.outcome, 'REUSED')
  assert.equal(reused.chargedAmount, '2.5')
  assert.equal(generateCalls, 1)

  await assert.rejects(
    () => createManualReportAnalysis({
      userId: premiumUser.id,
      assetType: AssetReportAssetType.STOCK,
      ticker: 'WXYZ4',
      originalFileName: 'curto.txt',
      contentType: 'text/plain',
      fileBase64: Buffer.from('curto demais', 'utf8').toString('base64'),
    }, runtime),
    (error: unknown) => {
      const err = error as Error & { statusCode?: number }
      assert.equal(err.message, 'REPORT_SOURCE_MANUAL_CONTENT_TOO_SHORT')
      assert.equal(err.statusCode, 422)
      return true
    },
  )

  await assert.rejects(
    () => createManualReportAnalysis({
      userId: premiumUser.id,
      assetType: AssetReportAssetType.STOCK,
      ticker: 'PETR4',
      originalFileName: 'vale3-relatorio.txt',
      contentType: 'text/plain',
      fileBase64: Buffer.from(
        'Relatorio fundamentalista da companhia VALE3 com destaque para mineracao, curva de custos, geracao de caixa e riscos de preco do minerio de ferro ao longo do ciclo.',
        'utf8',
      ).toString('base64'),
    }, runtime),
    (error: unknown) => {
      const err = error as Error & { statusCode?: number }
      assert.equal(err.message, 'REPORT_SOURCE_MANUAL_ASSET_MISMATCH')
      assert.equal(err.statusCode, 422)
      return true
    },
  )

  const premiumBalance = await getCreditBalance(premiumUser.id)
  assert.equal(new Prisma.Decimal(premiumBalance.balance).toFixed(2), '3.50')

  const premiumLedger = await listCreditLedger(premiumUser.id)
  assert.equal(premiumLedger.filter((entry) => entry.kind === 'DEBIT').length, 1)
})

test('reports-on-demand.spec: virada de mês invalida cache mensal da modalidade BRAPI', async () => {
  const author = await createTestUser({ name: 'Month Boundary Author', plan: PlanType.FREE })
  const other = await createTestUser({ name: 'Month Boundary Other', plan: PlanType.FREE })
  await seedCredits(author.id, 6, 'month-author')
  await seedCredits(other.id, 6, 'month-other')

  let generateCalls = 0
  const runtime = {
    resolveAutoSource: async () => ({
      assetType: AssetReportAssetType.STOCK,
      ticker: 'PETR4',
      sourceKind: 'AUTO_FOUND' as const,
      sourceUrl: 'https://brapi.dev/quote/PETR4',
      documentFingerprint: 'fp-petr4-shared',
      metadata: { provider: 'test' },
      promptContext: 'context',
    }),
    generateAnalysis: async () => {
      generateCalls += 1
      return '• cache 1\n• cache 2\n• cache 3\n• cache 4\n• cache 5'
    },
  }

  const april = await createOnDemandReportAnalysis({
    userId: author.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'PETR4',
  }, {
    ...runtime,
    now: () => new Date('2026-04-30T23:00:00.000Z'),
  })

  assert.equal(april.outcome, 'GENERATED')

  const may = await createOnDemandReportAnalysis({
    userId: other.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'PETR4',
  }, {
    ...runtime,
    now: () => new Date('2026-05-01T00:01:00.000Z'),
  })

  assert.equal(may.outcome, 'GENERATED')
  assert.equal(generateCalls, 2)
})

test('reports-on-demand.spec: cache mensal é isolado por modalidade', async () => {
  const user = await createTestUser({ name: 'Mode Isolation User', plan: PlanType.FREE })
  await seedCredits(user.id, 10, 'mode-isolation')

  let autoGenerateCalls = 0
  let manualGenerateCalls = 0

  const auto = await createOnDemandReportAnalysis({
    userId: user.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'ABCD4',
  }, {
    resolveAutoSource: async () => ({
      assetType: AssetReportAssetType.STOCK,
      ticker: 'ABCD4',
      sourceKind: 'AUTO_FOUND' as const,
      sourceUrl: 'https://brapi.dev/quote/ABCD4',
      documentFingerprint: 'fp-abcd4-auto',
      metadata: { provider: 'test' },
      promptContext: 'context',
    }),
    generateAnalysis: async () => {
      autoGenerateCalls += 1
      return '• auto 1\n• auto 2\n• auto 3\n• auto 4\n• auto 5'
    },
    now: () => new Date('2026-04-14T12:00:00.000Z'),
  })

  assert.equal(auto.outcome, 'GENERATED')

  const manual = await createManualReportAnalysis({
    userId: user.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'ABCD4',
    originalFileName: 'abcd4-relatorio.txt',
    contentType: 'text/plain',
    fileBase64: Buffer.from(
      'Relatorio fundamentalista da companhia ABCD4 com receita crescente, margem operacional estavel, disciplina de capital e riscos mapeados para os proximos trimestres.',
      'utf8',
    ).toString('base64'),
  }, {
    generateAnalysis: async () => {
      manualGenerateCalls += 1
      return '• manual 1\n• manual 2\n• manual 3\n• manual 4\n• manual 5'
    },
    now: () => new Date('2026-04-14T12:05:00.000Z'),
  })

  assert.equal(manual.outcome, 'GENERATED')
  assert.equal(autoGenerateCalls, 1)
  assert.equal(manualGenerateCalls, 1)
})

test('reports-on-demand.spec: RI reaproveita cache mensal entre usuarios e evita reprocessar upload', async () => {
  const author = await createTestUser({ name: 'RI Cache Author', plan: PlanType.FREE })
  const premium = await createTestUser({ name: 'RI Cache Premium', plan: PlanType.PREMIUM })
  await seedCredits(author.id, 8, 'ri-cache-author')
  await seedCredits(premium.id, 8, 'ri-cache-premium')

  let generateCalls = 0
  const runtime = {
    generateAnalysis: async () => {
      generateCalls += 1
      return '• ri 1\n• ri 2\n• ri 3\n• ri 4\n• ri 5'
    },
    now: () => new Date('2026-04-14T12:00:00.000Z'),
  }

  const first = await createManualReportAnalysis({
    userId: author.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'PETR4',
    originalFileName: 'petr4-ri-valid.txt',
    contentType: 'text/plain',
    fileBase64: Buffer.from(
      'Relatorio de relacoes com investidores da PETR4 com comentarios sobre receita, margens, investimentos e riscos operacionais para o restante do ano.',
      'utf8',
    ).toString('base64'),
  }, runtime)

  assert.equal(first.outcome, 'GENERATED')
  assert.equal(first.chargedAmount, '4')

  const reused = await createManualReportAnalysis({
    userId: premium.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'PETR4',
    originalFileName: 'arquivo-curto.txt',
    contentType: 'text/plain',
    fileBase64: Buffer.from('curto', 'utf8').toString('base64'),
  }, runtime)

  assert.equal(reused.outcome, 'REUSED')
  assert.equal(reused.chargedAmount, '2.5')
  assert.equal(generateCalls, 1)

  const premiumBalance = await getCreditBalance(premium.id)
  assert.equal(new Prisma.Decimal(premiumBalance.balance).toFixed(2), '5.50')
})

test('reports-on-demand.spec: virada de mês invalida cache mensal da modalidade RI', async () => {
  const author = await createTestUser({ name: 'RI Month Author', plan: PlanType.FREE })
  const other = await createTestUser({ name: 'RI Month Other', plan: PlanType.FREE })
  await seedCredits(author.id, 8, 'ri-month-author')
  await seedCredits(other.id, 8, 'ri-month-other')

  let generateCalls = 0
  const runtime = {
    generateAnalysis: async () => {
      generateCalls += 1
      return '• ri month 1\n• ri month 2\n• ri month 3\n• ri month 4\n• ri month 5'
    },
  }

  const april = await createManualReportAnalysis({
    userId: author.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'VALE3',
    originalFileName: 'vale3-ri-apr.txt',
    contentType: 'text/plain',
    fileBase64: Buffer.from(
      'Relatorio de investidores da VALE3 com visao de producao, custos, disciplina de capital e riscos para os proximos trimestres.',
      'utf8',
    ).toString('base64'),
  }, {
    ...runtime,
    now: () => new Date('2026-04-30T22:30:00.000Z'),
  })

  assert.equal(april.outcome, 'GENERATED')

  const may = await createManualReportAnalysis({
    userId: other.id,
    assetType: AssetReportAssetType.STOCK,
    ticker: 'VALE3',
    originalFileName: 'vale3-ri-may.txt',
    contentType: 'text/plain',
    fileBase64: Buffer.from(
      'Relatorio de investidores da VALE3 com atualizacao operacional, investimentos e risco de ciclo de commodities para o novo mes.',
      'utf8',
    ).toString('base64'),
  }, {
    ...runtime,
    now: () => new Date('2026-05-01T00:10:00.000Z'),
  })

  assert.equal(may.outcome, 'GENERATED')
  assert.equal(generateCalls, 2)
})