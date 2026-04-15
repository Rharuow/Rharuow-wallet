# Lote 6 - Baseline de Contratos (Fase 0)

Data de referencia: 2026-04-14
Branch de execucao: feat/lote-6-fase0-preparacao

## Objetivo

Congelar os contratos atuais do modulo de relatorios antes da refatoracao do Lote 6.

## Endpoints atuais

- POST /v1/reports/jobs
- POST /v1/reports/jobs/manual
- GET /v1/reports/jobs
- GET /v1/reports/jobs/:id
- POST /v1/reports/analysis
- POST /v1/reports/analysis/manual
- GET /v1/reports/analysis/:id

## Contrato atual - Criacao de job automatico

Request:
- assetType: STOCK | FII
- ticker: string

Response 202:
- job.id
- job.userId
- job.assetType
- job.ticker
- job.requestMode = AUTO_WEB
- job.status
- job.attemptCount
- job.failureCode
- job.failureMessage
- job.priceCharged
- job.analysisId
- job.sourceId
- job.lockedAt
- job.startedAt
- job.finishedAt
- job.metadata
- job.createdAt
- job.updatedAt

## Contrato atual - Criacao de job manual

Request:
- assetType: STOCK | FII
- ticker: string
- originalFileName: string
- contentType?: string
- fileBase64: string

Response 202:
- mesmo shape de job do automatico
- requestMode = MANUAL_UPLOAD
- metadata com originalFileName/contentType/storageKey/fileSizeBytes

## Contrato atual - Leitura de analise

GET /v1/reports/analysis/:id

Response 200:
- access.id
- access.expiresAt
- analysis.id
- analysis.assetType
- analysis.ticker
- analysis.analysisText
- analysis.model
- analysis.validUntil
- analysis.source.id
- analysis.source.sourceKind (AUTO_FOUND | MANUAL_UPLOAD)
- analysis.source.sourceUrl
- analysis.source.originalFileName
- analysis.source.title
- analysis.source.publisher
- analysis.source.sourceType
- analysis.source.discoveryMethod

## Comportamento funcional atual (antes do L6)

- Reuso de analise ocorre por documento/fonte valida (nao por chave mensal de modalidade).
- Fluxo automatico pode usar busca web controlada com fallback local.
- Fluxo manual usa upload + IA.
- Cobranca atual e orientada a sucesso final e nao diferencia modalidade no cache mensal.

## Mudancas previstas no L6 (alvo de comparacao)

- Introduzir reportMode explicito: BRAPI_TICKER x RI_UPLOAD_AI.
- Introduzir monthKey (YYYY-MM) e reuso mensal compartilhado entre usuarios.
- Isolar cache por modalidade.
- Aplicar precificacao por modalidade + plano.
