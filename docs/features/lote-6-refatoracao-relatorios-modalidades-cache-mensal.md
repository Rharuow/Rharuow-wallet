# Lote 6 - Refatoração de Relatorios por Modalidade com Cache Mensal

## Objetivo de produto

Refatorar o fluxo de relatorios para operar com duas modalidades independentes:

- `BRAPI_TICKER`: análise gerada a partir de dados estruturados da rota `https://brapi.dev/quote/<ticker>`.
- `RI_UPLOAD_AI`: análise gerada a partir de RI enviado pelo usuario e processado pela OpenAI.

Cada modalidade deve ter cache mensal compartilhado entre usuários, com expiração na virada de mês e isolamento total entre os tipos de análise.

## Status atual

- Estado: `completed`
- Lote atual: `L6`
- Ultima atualizacao: `2026-04-14`
- Fase 0: `completed`
- Fase 1: `completed`
- Fase 2: `completed`
- Fase 3: `completed`
- Fase 4: `completed`
- Fase 5: `completed`
- Fase 6: `completed`
- Fase 7: `completed`

## Escopo do L6

- Separar regras de negocio de relatorio por modalidade.
- Introduzir cache mensal por `assetType + ticker + reportMode + monthKey`.
- Aplicar precificacao por modalidade e plano.
- Simplificar UX para remover termos tecnicos.
- Cobrir fluxo com testes de unidade, integracao e e2e.

## Fora de escopo

- Streaming em tempo real por websocket.
- Alterar motor de filas (Kafka) neste lote.
- Mudançaas de infraestrutura fora do necessário para migrate/deploy.

## Regras de negocio (alvo)

1. Modalidades diferentes, caches diferentes:
	- BRAPI nao reaproveita RI.
	- RI nao reaproveita BRAPI.
2. Cache mensal compartilhado:
	- Se uma análise de PETR4 for gerada em abril para uma modalidade, qualquer usuário reaproveita a mesma análise nessa modalidade ate o fim de abril.
3. Expiração de cache:
	- Expira na virada do mes (`01/MM+1 00:00:00`).
4. Cobranca por sucesso:
	- Debitar apenas em `COMPLETED`.
5. Precificacao por modalidade:
	- BRAPI_TICKER: Premium `R$ 1,50`, Free `R$ 2,50`.
	- RI_UPLOAD_AI: Premium `R$ 2,50`, Free `R$ 4,00`.

## Modelagem de dados (proposta)

### 1) Novos enums

- `ReportMode`:
  - `BRAPI_TICKER`
  - `RI_UPLOAD_AI`

### 2) Campos novos

- Em `AssetReportSource`:
  - `reportMode ReportMode`
  - `monthKey String` no formato `YYYY-MM` (exemplo: `2026-04`)

- Em `AssetReportAnalysis`:
  - `reportMode ReportMode`
  - `monthKey String`

### 3) Índices/unicidade

- `AssetReportSource`:
  - `@@index([assetType, ticker, reportMode, monthKey])`
- `AssetReportAnalysis`:
  - `@@index([assetType, ticker, reportMode, monthKey, validUntil])`

Observação: manter índices antigos durante migração e remover apenas após estabilização, se não forem mais necessários.

## Endpoints e contratos (alvo)

1. Fluxo ticker (BRapi):
	- Mantém endpoint de criação, mas request interno deve marcar `reportMode=BRAPI_TICKER`.
2. Fluxo upload RI:
	- Mantém endpoint manual, marcando `reportMode=RI_UPLOAD_AI`.
3. Payload de retorno (jobs/analysis):
	- Adicionar `reportMode` para UI e auditoria.

## Step by step de execução

## Fase 0 - Preparação técnica

### Objetivo

Garantir baseline reproduzível antes da refatoração.

### Tarefas

1. Criar branch dedicada para o lote.
2. Rodar testes atuais de API e web para baseline.
3. Congelar contratos atuais em nota de controle (antes/depois).

### Validação

- `npm run test:integration --workspace=services/api`
- Registrar falhas pre-existentes para nao confundir com regressao do lote.

### Critério de aceite

- Baseline de testes documentado.

### Execucao registrada (2026-04-14)

1. Fluxo RI consolidado com cache mensal proprio da modalidade:
	- reuso por `assetType + ticker + reportMode=RI_UPLOAD_AI + monthKey`
2. Reuso mensal no modo RI acontece antes do processamento pesado:
	- evita parse/validacao/upload quando ja existe analise valida do mes
3. Validade mensal preservada no modo RI:
	- virada de mes invalida cache anterior da modalidade RI
4. Testes novos de dominio adicionados:
	- reuso RI entre usuarios no mesmo mes sem reprocessar upload
	- virada de mes invalida cache da modalidade RI
5. Validacao tecnica concluida:
	- `npm run build --workspace=services/api`
	- `npm run test:integration --workspace=services/api`
	- resultado: sem falhas

### Execucao registrada (2026-04-14)

1. Fluxo ticker consolidado para origem estruturada principal:
	- `defaultResolveAutoSource` passou a selecionar fonte local estruturada diretamente.
	- para `STOCK`, a origem principal e BRapi (`resolveStockAutoSource`).
2. Dependencia funcional da busca web removida do caminho principal ticker:
	- `createOnDemandReportAnalysis` nao usa mais `resolveWebSearchSource` no default.
3. Telemetria de selecao ajustada:
	- labels de log agora refletem `BRAPI_PRIMARY` e `FUNDAMENTUS_PRIMARY`.
4. Teste de comportamento atualizado para o novo objetivo:
	- validacao explicita de origem principal BRapi no modo ticker.
5. Validacao tecnica concluida:
	- `npm run build --workspace=services/api`
	- `npm run test:integration --workspace=services/api`
	- resultado: sem falhas

### Execucao registrada (2026-04-14)

1. Matriz de precificacao por modalidade implementada:
	- `BRAPI_TICKER`: Free `2.50`, Premium `1.50`
	- `RI_UPLOAD_AI`: Free `4.00`, Premium `2.50`
2. Calculo de preco por plano passou a receber `reportMode` no dominio:
	- `getUserReportPricing(userId, reportMode)`
3. Fluxos ajustados para usar a modalidade correta no preco:
	- `createOnDemandReportAnalysis` usa `BRAPI_TICKER`
	- `createManualReportAnalysis` usa `RI_UPLOAD_AI`
4. Testes de relatorios atualizados para refletir novos valores da modalidade RI.
5. Validacao tecnica concluida:
	- `npm run build --workspace=services/api`
	- `npm run test:integration --workspace=services/api`
	- resultado: sem falhas

### Execucao registrada (2026-04-14)

1. Regras de reuso mensal por modalidade implementadas em dominio:
	- busca reutilizavel agora filtra por `assetType + ticker + reportMode + monthKey`
	- reuso nao depende mais de fingerprint para cache mensal
2. Isolamento por modalidade aplicado tambem em acesso ativo:
	- `findActiveAssetReportAccess` passou a filtrar por `reportMode + monthKey`
3. Short-circuit de cache mensal aplicado antes do fluxo pesado:
	- no fluxo BRapi, reuso e tentado antes de resolver fonte novamente
	- no fluxo RI, reuso e tentado antes de parse/validacao/upload do arquivo
4. Validade ajustada para virada de mes:
	- `validUntil` da analise e calculado para o primeiro dia do proximo mes (UTC)
	- `expiresAt` do acesso segue a validade da analise quando houver cobranca
5. Testes adicionados para as novas regras:
	- virada de mes invalida cache da modalidade BRapi
	- cache mensal e isolado por modalidade (BRapi x RI)
6. Validacao tecnica concluida:
	- `npm run build --workspace=services/api`
	- `npm run test:integration --workspace=services/api`
	- resultado: sem falhas

### Execucao registrada (2026-04-14)

1. Branch dedicada criada:
	- `feat/lote-6-fase0-preparacao`
2. Baseline de API executado com sucesso:
	- comando: `npm run test:integration --workspace=services/api`
	- resultado: todos os arquivos de teste de integracao passaram
3. Baseline de web executado com sucesso:
	- comando: `npm run build --workspace=apps/web`
	- resultado: build finalizado sem erro de compilacao
4. Contratos congelados em arquivo de referencia:
	- `docs/features/lote-6-baseline-contratos.md`

Observacao:
- O build do web exibiu apenas aviso de deprecacao de `middleware` no Next.js, sem bloquear a execucao da Fase 0.

---

## Fase 1 - Modelagem e migração de banco

### Objetivo

Adicionar base de dados para separar cache por modalidade e mes.

### Tarefas

1. Atualizar schema Prisma com `ReportMode`, `monthKey` e `reportMode`.
2. Gerar migration.
3. Ajustar tipos no código para campos obrigatorios novos.

### Arquivos provaveis

- `services/api/prisma/schema.prisma`
- `services/api/prisma/migrations/*`

### Validação

- `npm run db:generate --workspace=services/api`
- `npm run db:migrate --workspace=services/api`

### Critério de aceite

- Migration aplicada localmente sem quebra de inicializacao da API.

### Execucao registrada (2026-04-14)

1. Schema Prisma atualizado com:
	- enum `ReportMode`
	- `reportMode` e `monthKey` em `AssetReportSource`
	- `reportMode` e `monthKey` em `AssetReportAnalysis`
2. Migration criada e aplicada:
	- `services/api/prisma/migrations/20260414162829_l6_phase1_report_mode_month_key/migration.sql`
3. Backfill seguro implementado no SQL da migration:
	- preenche `report_mode` e `month_key` para dados existentes
	- define `NOT NULL` apenas apos backfill
4. Tipos e servicos ajustados para campos obrigatorios novos:
	- `report-analysis.service.ts`
	- `reports.service.ts`
	- `report-analysis-access.test.ts`
5. Validacao tecnica concluida:
	- `npm run build --workspace=services/api`
	- `npm run test:integration --workspace=services/api`
	- resultado: sem falhas

### Rollback

- Reverter migration do lote antes de subir para ambiente compartilhado.

---

## Fase 2 - Regras centrais de cache mensal

### Objetivo

Implementar lookup e persistencia por modalidade + mes.

### Tarefas

1. Criar helper de calendario:
	- `monthKey` atual (`YYYY-MM`).
	- `validUntil` no primeiro dia do proximo mes.
2. Alterar busca reutilizavel para filtrar por:
	- `assetType`
	- `ticker`
	- `reportMode`
	- `monthKey`
3. Alterar persistencia de source/analysis para gravar `reportMode` e `monthKey`.

### Arquivos provaveis

- `services/api/src/modules/reports/report-analysis.service.ts`
- `services/api/src/modules/reports/reports.service.ts`

### Validação

1. Requisicao 1 cria análise no mes.
2. Requisicao 2 no mesmo mes e modalidade reaproveita.
3. Requisicao em modalidade diferente nao reaproveita.

### Critério de aceite

- Reuso mensal funcionando e isolado por modalidade.

---

## Fase 3 - Precificacao por modalidade

### Objetivo

Aplicar cobranca correta por plano e tipo de relatorio.

### Tarefas

1. Substituir preco unico por matriz:
	- `priceByModeAndPlan`.
2. Integrar calculo no fluxo ticker e no fluxo RI.
3. Garantir que `priceCharged` do job reflita modalidade correta.
4. Ajustar descricao/metadata de ledger com `reportMode`.

### Arquivos provaveis

- `services/api/src/modules/reports/reports.service.ts`
- `services/api/src/modules/reports/report-jobs.processor.ts`

### Validação

1. Free + BRapi = `2.50`.
2. Premium + BRapi = `1.50`.
3. Free + RI = `4.00`.
4. Premium + RI = `2.50`.

### Critério de aceite

- Debito correto em todos os cenarios e apenas em sucesso.

---

## Fase 4 - Refactor do fluxo BRapi (ticker)

### Objetivo

Consolidar fluxo ticker com fonte BRapi, sem depender da busca web da OpenAI.

### Tarefas

1. No modo `BRAPI_TICKER`, obter dados por quote BRapi.
2. Gerar texto/estrutura de análise com base nesses dados.
3. Persistir source/analysis com `reportMode=BRAPI_TICKER`.

### Arquivos provaveis

- `services/api/src/modules/reports/reports.service.ts`
- `services/api/src/lib/brapiStocksClient.ts` (se precisar de ajuste)

### Validação

- PETR4 retorna relatorio consistente com dados da BRapi.

### Critério de aceite

- Fluxo ticker independente da busca web OpenAI.

---

## Fase 5 - Refactor do fluxo RI (upload + OpenAI)

### Objetivo

Manter RI como modalidade propria com cache mensal proprio.

### Tarefas

1. Marcar explicitamente `reportMode=RI_UPLOAD_AI`.
2. Reuso mensal RI por ticker/modalidade/mes.
3. Preservar validação de pertinencia do documento para o ativo.

### Validação

- Upload RI do mesmo ticker no mesmo mes reaproveita cache RI.
- BRapi e RI nao se cruzam.

### Critério de aceite

- Isolamento completo dos caches por modalidade confirmado.

---

## Fase 6 - UX copy e fluxo simplificado no web

### Objetivo

Eliminar linguagem tecnica e deixar as duas opcoes de análise claras.

### Tarefas

1. Renomear termos:
	- "job" -> "solicitacao" ou "análise".
	- "on-demand" -> "relatorio do ativo".
2. Exibir dois caminhos explicitos:
	- Gerar pelo ticker (BRapi).
	- Enviar RI (OpenAI).
3. Exibir preco de cada modalidade antes do clique.

### Arquivos provaveis

- `apps/web/components/OnDemandReportCard.tsx`
- `apps/web/e2e/reports-on-demand.spec.ts`

### Validação

- UI sem termos tecnicos de programacao.
- Usuario entende diferenca entre os dois tipos.

### Critério de aceite

- Fluxo legivel, simples e sem ambiguidade de cobranca.

### Execucao registrada (2026-04-14)

1. Copy da UX simplificada para linguagem de produto:
	- termos como "on-demand" e "job" foram substituidos por "relatorio por ticker" e "solicitacao".
2. CTAs ajustadas para dois caminhos claros:
	- fluxo por ticker: "Gerar leitura".
	- fluxo com arquivo: "Gerar leitura com arquivo".
3. Ajustes de contexto feitos em telas de acoes, FIIs e pagina de relatorios:
	- titulos/subtitulos atualizados para reduzir jargao tecnico.
4. Spec e2e de relatorios atualizada para os novos rótulos visiveis.
5. Validacao tecnica concluida:
	- `npx tsc --noEmit` em `apps/web`
	- resultado: sem erros de tipo
6. Spec e2e validada com execucao real:
	- teste: `manual upload creates queued requests without immediate debit`
	- resultado: 1 passed (7.9s / total 20.5s)
	- fluxo: criacao de usuario, seed de creditos, upload de arquivo, assert 202, assert "Solicitacao atual" + "Na fila", assert sem debito pre-COMPLETED

---

## Fase 7 - Testes e validação final

### Objetivo

Evitar regressao e provar regras novas de cache mensal e preco por modalidade.

### Tarefas

1. Testes unitarios/integracao API:
	- cache mensal por modalidade
	- expiração na virada de mes
	- precificacao por plano e modalidade
2. Testes e2e web:
	- copy simplificada
	- precos corretos na UI
	- fluxo BRapi e fluxo RI distintos

### Validação

- `npm run test:integration --workspace=services/api`
- `npm run build --workspace=apps/web`
- Rodar spec e2e de relatorios

### Critério de aceite

- Nenhuma regressao critica aberta para os fluxos de relatorio.

### Execucao registrada (2026-04-14)

1. Testes de integracao da API verificados:
	- comando: `npm run test:integration --workspace=services/api`
	- resultado: 11 testes de reports-on-demand.spec + 2 de shared-read-write-guards + 1 de unread-count — todos passaram
	- cobertos: cache mensal por modalidade, expiracao virada de mes, precificacao BRapi x RI, reuso entre usuarios
2. Build web verificado:
	- comando: `npm run build --workspace=apps/web`
	- resultado: build concluido sem erro
3. Spec e2e de relatorios verificada (detalhes em Fase 6).
4. Observabilidade minima adicionada em `reports.service.ts`:
	- `report-cache-active-access`: usuario ja tem acesso ativo para ticker/modalidade/mes
	- `report-cache-hit`: analise mensal reutilizada (cache compartilhado)
	- `report-cache-miss`: nenhum cache — analise nova sera gerada
	- todos os eventos incluem `userId`, `ticker`, `reportMode`, `monthKey`
5. Build da API revalidado apos adicao dos logs: sem erros.

---

## Checklist de controle do lote

- [x] Migration aplicada e versionada
- [x] `reportMode` propagado em source, analysis e job response
- [x] cache mensal por modalidade funcionando
- [x] expiração na virada de mes validada
- [x] cobranca BRapi x RI por plano validada
- [x] UI sem termos tecnicos
- [x] testes de API atualizados
- [x] testes e2e atualizados
- [x] observabilidade minima (logs de mode, monthKey, cache hit/miss)

## Riscos e mitigacoes

1. Risco: RI mensal compartilhado por ticker pode reaproveitar contexto de arquivo de outro usuario.
	- Mitigacao: documentar decisao de produto e exibir na telemetria tipo de cache hit.
2. Risco: regressao na cobranca por alterar matriz de preco.
	- Mitigacao: testes automatizados para os 4 cenarios de preco.
3. Risco: queries antigas sem filtro de modalidade.
	- Mitigacao: revisar todos os pontos de reuso e acesso com busca textual por `findReusable` e `findActiveAccess`.

## Definicao de pronto (DoD)

1. Reuso mensal funcionando por modalidade sem cruzamento.
2. Expiração efetiva na virada do mes em producao.
3. Precificacao correta para BRapi e RI por plano.
4. UX simplificada e sem termos tecnicos.
5. Testes chave verdes e revisao final concluida.

## Proximo passo exato

- Ticket a executar: `L6-07`
- Objetivo tecnico: simplificar UX e copy do frontend removendo termos tecnicos e deixando claras as duas modalidades de analise.
- Arquivos provaveis:
	- `apps/web/components/OnDemandReportCard.tsx`
	- `apps/web/e2e/reports-on-demand.spec.ts`
- Testes minimos esperados:
	- copy sem termos como "job" e "on-demand"
	- diferenciação clara entre "relatorio por ticker (BRapi)" e "analise de arquivo RI (OpenAI)"
	- exibicao dos precos corretos por modalidade/plano
- Nao fazer ainda:
	- alterar contratos de API alem do necessario para consumo da nova UX
