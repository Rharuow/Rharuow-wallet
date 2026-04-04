# Lote 4 - Créditos e Relatórios On-Demand

## Objetivo de produto

Criar uma carteira de créditos pré-pagos para usuários `FREE` e `PREMIUM`, permitindo cobrar por consumo na análise de relatórios de ações e FIIs, com acesso temporário de 30 dias e reaproveitamento de análises para preservar margem operacional.

## Status atual

- Estado: `completed`
- Lote atual: `Lote 4 concluído`
- Última atualização: `2026-04-04`
- Implementado nesta etapa:
  - Modelagem Prisma da carteira de créditos (`UserCreditBalance`, `CreditLedgerEntry`, `CreditTopupOrder`)
  - Serviço transacional inicial para crédito, débito e ledger
  - Modelagem Prisma de reuso de análise (`AssetReportSource`, `AssetReportAnalysis`, `UserAssetReportAccess`)
  - Reuso seguro por `ticker + fingerprint` e acesso temporário de 30 dias
  - Endpoint de recarga `POST /v1/credits/topups` com checkout Stripe em modo `payment`
  - Webhook Stripe com crédito idempotente para top-up
  - Endpoints de saldo e extrato (`GET /v1/credits/balance`, `GET /v1/credits/ledger`)
  - Pipeline backend de busca automática do documento-base por ticker
  - Endpoint `POST /v1/reports/analysis` com geração, reuso, débito por plano e acesso por 30 dias
  - Endpoint `GET /v1/reports/analysis/:id` para leitura segura de análise liberada
  - UI de créditos em `/dashboard/creditos`
  - UI de consulta de relatório em `/dashboard/relatorios`
  - Integração do fluxo on-demand nas páginas de ações e FIIs
  - Testes de integração para saldo, extrato, checkout de recarga, webhook, reuso, não-cobrança em falha e cobrança por plano
  - E2E final do fallback manual cobrindo débito único e acesso ativo posterior

## Escopo do MVP

- Saldo pré-pago via Stripe
- Consulta por ticker de ação/FII
- Busca automática do relatório
- Análise com IA baseada no relatório
- Cobrança diferenciada por plano
- Acesso por 30 dias
- Reaproveitamento da análise
- Fallback de upload manual quando a busca falhar

## Fora de escopo

- Múltiplos tipos de documento por ativo com escolha manual avançada
- Reembolso self-service no frontend
- Expiração automática de créditos promocionais
- Precificação dinâmica por tamanho do relatório
- Painel administrativo completo de auditoria financeira

## Regras de negócio

- Usuários `FREE` e `PREMIUM` podem adicionar crédito à conta.
- A recarga deve ser paga via Stripe.
- Valor mínimo de recarga: `R$ 3,00`.
- Sugestões de recarga no frontend: `R$ 5`, `R$ 10`, `R$ 20`, `R$ 50`.
- Usuário `FREE`: `R$ 2,50` por análise.
- Usuário `PREMIUM`: `R$ 1,50` por análise.
- A cobrança só acontece quando a análise estiver pronta ou quando o acesso reaproveitado for efetivamente concedido.
- Não debitar em caso de relatório não encontrado ou falha operacional antes do sucesso.

## Modelagem de dados

### Crédito

- `UserCreditBalance`
  - saldo atual do usuário
  - atualização transacional
- `CreditLedgerEntry`
  - crédito, débito, reversão e ajuste
  - guarda `balanceAfter` para auditoria
  - referencia opcional à ordem de recarga
- `CreditTopupOrder`
  - ordem de recarga com status `PENDING | PAID | FAILED | CANCELED`
  - vínculo com sessão/intent da Stripe

### Próxima modelagem

- `AssetReportSource`
- `AssetReportAnalysis`
- `UserAssetReportAccess`

## Endpoints e contratos

### Já existentes e reaproveitáveis

- Webhook Stripe em `/v1/payments/webhook`

### Implementados

- `POST /v1/credits/topups`
- `GET /v1/credits/balance`
- `GET /v1/credits/ledger`
- `POST /v1/reports/analysis`
- `GET /v1/reports/analysis/:id`

### Observação de contrato

- `POST /v1/reports/analysis/manual` permanece disponível no backend, embora o frontend consolidado utilize `POST /v1/reports/analysis` com `manualUpload: true`

## Fluxos principais

### Recarga

1. Usuário inicia recarga.
2. Sistema cria `CreditTopupOrder` pendente.
3. Stripe confirma pagamento.
4. Webhook marca ordem como paga e credita saldo com entrada no ledger.

### Consumo

1. Usuário pede análise de ticker.
2. Sistema verifica acesso ativo.
3. Se não houver acesso, tenta reaproveitamento.
4. Se não houver reaproveitamento, busca o relatório e gera análise.
5. Apenas no sucesso, debita saldo e concede acesso por 30 dias.

## Critérios de aceite

1. Toda recarga paga gera exatamente um crédito no saldo.
2. Reprocessamento do webhook não duplica saldo.
3. Débito com saldo insuficiente retorna erro consistente e não altera o ledger.
4. Toda movimentação altera saldo e registra `balanceAfter`.
5. Nenhuma falha anterior ao sucesso da análise debita o usuário.

## Plano de entrega

| Ticket | Status | Prioridade | Dependências | Entrega objetiva |
|---|---|---|---|---|
| `L4-01` | Done | P0 | — | Criar `UserCreditBalance`, `CreditLedgerEntry` e `CreditTopupOrder` com índices e status |
| `L4-02` | Done | P0 | — | Criar `AssetReportSource`, `AssetReportAnalysis` e `UserAssetReportAccess` |
| `L4-03` | Done | P0 | `L4-01` | Permitir criação de checkout para top-up a partir de `R$ 3,00` |
| `L4-04` | Done | P0 | `L4-03` | Creditar saldo via webhook Stripe com idempotência e ledger |
| `L4-05` | Done | P1 | `L4-01`, `L4-04` | Endpoints para consultar saldo e histórico de movimentações |
| `L4-06` | Done | P0 | `L4-02` | Pipeline para localizar documento-base por ticker sem cobrança em falha |
| `L4-07` | Done | P1 | `L4-02` | Permitir upload manual como fallback |
| `L4-08` | Done | P0 | `L4-02`, `L4-06` | Reuso de análise antes de nova chamada à OpenAI |
| `L4-09` | Done | P0 | `L4-01`, `L4-08` | Débito por plano apenas em sucesso |
| `L4-10` | Done | P0 | `L4-02`, `L4-09` | Conceder acesso temporário por 30 dias |

## Matriz de status do lote

| Ticket | Status real | Evidência principal | Observação |
|---|---|---|---|
| `L4-01` | Entregue | Prisma + `credits.service` + `credits-ledger.test.ts` | Base transacional de saldo e ledger validada |
| `L4-02` | Entregue | Prisma + `report-analysis.service` + `report-analysis-access.test.ts` | Reuso restrito por fingerprint e acesso de 30 dias validado |
| `L4-03` | Entregue | `POST /v1/credits/topups` + `createCreditTopupCheckoutSession` | Valor mínimo de `R$ 3,00` aplicado no contrato público |
| `L4-04` | Entregue | `handleStripeEvent`/`handleWebhook` + `credits-topup-payments.test.ts` | Crédito idempotente por webhook de checkout em modo `payment` |
| `L4-05` | Entregue | `GET /v1/credits/balance` + `GET /v1/credits/ledger` | Extrato simples entregue sem paginação avançada |
| `L4-06` | Entregue | `reports.service` + resolução automática por ticker | Busca documento-base e não cobra quando a origem falha |
| `L4-07` | Entregue | `POST /v1/reports/analysis/manual` + parsing PDF/texto + `OnDemandReportCard` | Fallback manual fecha o fluxo quando não houver origem automática |
| `L4-08` | Entregue | `findReusableAssetReportAnalysis` + `POST /v1/reports/analysis` | Reuso executado antes de nova geração |
| `L4-09` | Entregue | Preço por plano em `reports.service` + testes | Débito só acontece em sucesso |
| `L4-10` | Entregue | `user_asset_report_accesses` + fluxo on-demand real | Acesso temporário concedido no desbloqueio |
| `L4-11` | Entregue | `/dashboard/creditos` | UI mínima de saldo, recarga e extrato entregue |
| `L4-12` | Entregue | `/dashboard/relatorios` + cards de ações/FIIs + upload manual | Fluxo cobre origem automática e fallback manual |
| `L4-13` | Entregue | `reports-on-demand.test.ts` + testes de crédito | Cobertura de crédito, débito, não-cobrança em falha e reaproveitamento |
| `L4-14` | Entregue | `apps/web/e2e/reports-on-demand.spec.ts` | E2E cobre fallback manual, débito único e acesso ativo posterior |
| `L4-15` | Entregue | Logs estruturados em `credits.routes` e `reports.routes` | Fluxo final ganhou trilha operacional mínima de auditoria |

## Pendências e riscos

- O fluxo de recarga atual de assinatura premium segue como ponto de atenção regressiva em futuras mudanças de pagamentos.
- Ainda vale decidir, em evolução futura, se o ledger externo permanecerá em `Decimal` ou migrará para centavos inteiros em contratos públicos.

## Próximo passo exato

- Tickets concluídos: `L4-01` até `L4-15`
- Objetivo técnico entregue: carteira de créditos, recarga Stripe, análise on-demand com reuso, fallback manual, acesso temporário, UI operacional e hardening final.
- Evidências mínimas: `reports-on-demand.test.ts`, `apps/web/e2e/reports-on-demand.spec.ts`, `credits-topup-payments.test.ts`, `reports.routes.ts`, `credits.routes.ts`.
- Próxima revisão: apenas se houver expansão de escopo ou ajustes pós-produção.