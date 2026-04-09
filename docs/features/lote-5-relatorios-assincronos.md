# Lote 5 - Relatórios Assíncronos e Busca Web Controlada

## Objetivo de produto

Evoluir a experiencia de relatorios on-demand para um modelo assincrono, com acompanhamento de status pelo usuario, busca automatica de documentos na web com controle de custo e validacao de uploads manuais antes da analise final.

## Status atual

- Estado: `completed`
- Lote atual: `validação operacional final`
- Última atualização: `2026-04-07`

Implementado nesta etapa:

- Modelagem Prisma inicial de `ReportAnalysisJob` e `ReportSearchCooldown`
- Serviço mínimo para criar jobs, atualizar status, listar jobs e consultar cooldown ativo
- Testes de persistência e atualização de status/cooldown
- Producer Kafka para publicação de jobs de análise
- Worker inicial para consumo de jobs e atualização de status/cooldown
- Scripts de execução do worker no serviço da API
- Endpoints de jobs assíncronos para criação, listagem e consulta por id
- Upload manual persistido em object storage local com leitura por `storageKey` no worker
- Validação heurística de pertinência do upload manual antes de análise e cobrança
- Fallback controlado de busca automática: fonte local primeiro, OpenAI web search depois
- Hook de runtime para teste do fallback sem dependência real da OpenAI
- Cobertura do fluxo on-demand validando uso do fallback web com cobrança normal em sucesso
- UI web de jobs assíncronos com criação, polling simples, histórico recente e leitura liberada só em `COMPLETED`
- Proxies autenticados no `apps/web` para criação, listagem e consulta de jobs
- Checkout de recarga de créditos com fallback local por `session_id` para ambientes sem webhook Stripe
- Retry automático de checkout para `card` quando `pix` não estiver habilitado na conta Stripe
- Exibição da fonte usada na análise com link clicável para o usuário final
- Busca automática priorizando documento oficial de RI/IR via OpenAI web search antes do fallback BRapi/Fundamentus
- Logs de debug da resolução de fonte via `REPORT_SOURCE_DEBUG=true`
- Enriquecimento do texto final da análise com apêndice de valuation usando Graham/Bazin quando houver dados suficientes

## Escopo do MVP

- Criar jobs assincronos de relatorio.
- Exibir status de processamento ao usuario.
- Processar busca automatica fora do request HTTP.
- Bloquear busca automatica por 30 dias quando um ativo nao tiver fonte localizavel.
- Validar upload manual antes da analise.
- Diferenciar preco entre fluxo automatico e manual.

## Fora de escopo

- Streaming em tempo real do progresso por websocket.
- Escolha manual entre multiplas fontes encontradas na web.
- Painel administrativo completo de auditoria de jobs.

## Regras de negócio

- Busca automatica:
  - Free: `R$ 2,50`
  - Premium: `R$ 1,50`
- Upload manual:
  - Free: `R$ 2,50`
  - Premium: `R$ 1,50`
- No estado atual do produto, automatico e manual compartilham a mesma cobranca por sucesso.
- Cobranca apenas em `Analise concluida`.
- Se a busca automatica falhar para um ativo, a busca automatica desse ativo fica indisponivel por 30 dias.
- Durante indisponibilidade, o usuario ainda pode enviar o documento manualmente.
- Documento manual deve ser validado como pertencente ao ativo antes da analise final.
- A fonte da análise deve ser persistida e exibida ao usuário com URL quando disponível.
- A busca automática deve tentar primeiro uma fonte oficial de RI/IR; BRapi/Fundamentus ficam como fallback.
- Em ambiente local, a confirmação de recarga de créditos pode ser feita por `session_id` sem depender exclusivamente de webhook Stripe.

## Modelagem de dados

- Novo job de processamento assincrono de relatorio.
- Novo registro de cooldown por ativo para busca automatica.
- Evolucao da origem do relatorio para registrar metodo de descoberta e validacao.

## Endpoints e contratos

Implementados para esta evolucao:

- `POST /v1/reports/jobs`
- `POST /v1/reports/jobs/manual`
- `GET /v1/reports/jobs`
- `GET /v1/reports/jobs/:id`
- `GET /v1/reports/analysis/:id`
- `POST /v1/payments/activate` como fallback local para confirmação de checkout

## Fluxos principais

### Automatico

1. Usuario solicita analise por ticker.
2. API verifica acesso ativo, reuso e cooldown.
3. Se precisar processar, cria job e retorna status inicial.
4. Worker busca fonte, analisa e atualiza status.
5. Usuario acompanha progresso na tela de relatorios.

### Manual

1. Usuario envia documento do proprio dispositivo.
2. API cria job manual.
3. Worker valida pertinencia do documento.
4. Se valido, gera analise e conclui o acesso.

## Critérios de aceite

1. Nenhuma request HTTP de criacao de relatorio aguarda a analise completa.
2. A tela de relatorios mostra status consistentes por requisicao.
3. Cobranca so acontece em sucesso final.
4. Cooldown de 30 dias impede novas buscas automaticas para ativo sem fonte encontrada.
5. Upload manual invalido nao gera cobranca.
6. A análise concluída informa a fonte usada e mostra link para abertura quando houver URL.
7. A busca automática prioriza RI/IR oficial antes de fallback local.
8. Em ambiente local, recarga de créditos pode ser confirmada no retorno do checkout mesmo sem webhook ativo.

## Plano de entrega

| Ticket | Status | Prioridade | Dependências | Entrega objetiva |
|---|---|---|---|---|
| `L5-01` Modelagem de jobs e cooldown | Done | P0 | `L4-10` | Criar job assincrono de relatorio e cooldown de busca automatica |
| `L5-02` Producer Kafka e worker inicial | Done | P0 | `L5-01` | Publicar jobs e processar pipeline fora da API principal |
| `L5-03` Endpoints de jobs | Done | P0 | `L5-01` | Criar contratos para criar, listar e consultar requisicoes |
| `L5-04` Upload manual em object storage | Done | P1 | `L5-01` | Tirar upload base64 do request e persistir arquivo externo |
| `L5-05` Validacao manual de pertinencia | Done | P0 | `L5-04` | Validar se o documento pertence ao ativo antes de analisar |
| `L5-06` Busca web controlada | Done | P1 | `L5-02` | Resolver fonte com heuristica + OpenAI web search |
| `L5-07` UI de status de jobs | Done | P0 | `L5-03` | Exibir timeline/status e liberar leitura so em `COMPLETED` |
| `L5-08` Checkout e cobrança por sucesso | Done | P0 | `L5-03` | Confirmar recarga localmente e debitar apenas em sucesso final |
| `L5-09` Transparência de fonte ao usuário | Done | P0 | `L5-06` | Exibir origem da análise com link de referência |
| `L5-10` RI oficial primeiro | Done | P0 | `L5-06` | Priorizar documento oficial de RI/IR antes de BRapi/Fundamentus |
| `L5-11` Debug de descoberta de fonte | Done | P1 | `L5-10` | Logar motivo de uso ou fallback da busca de RI |
| `L5-12` Valuation Graham/Bazin | Done | P1 | `L5-10` | Anexar cálculo quando houver base suficiente |

## Pendências e riscos

- A principal pendência restante é validação operacional contra o Kafka da Confluent Cloud, além do ambiente local com Docker.
- A busca via OpenAI pode não localizar RI utilizável em todos os ativos; nesse caso o fallback local continua sendo necessário.
- Bazin para ações depende de DY/dividendo anual disponível no provider; quando o dado não vier, a análise explicita a indisponibilidade.
- A UI usa polling simples; se o volume crescer, convem migrar para estratégia incremental ou eventos.

## Próximo passo exato

- Ticket a executar: `Validação final Confluent Cloud`
- Objetivo técnico: validar publicação, consumo e conclusão ponta a ponta do pipeline assíncrono usando o broker/configuração mais próxima de produção.
- Arquivos prováveis:
  - `services/api/.env`
  - `services/api/src/workers/report-analysis-worker.ts`
  - `services/api/src/modules/reports/report-jobs.processor.ts`
  - `services/api/src/lib/kafka.ts`
- Testes mínimos esperados:
  - job publicado no Kafka da Confluent Cloud e consumido pelo worker
  - transição de `QUEUED` até `COMPLETED` ou estado terminal consistente
  - cobrança de crédito apenas em sucesso final
  - exibição da fonte com link na UI após conclusão
  - logs de `REPORT_SOURCE_DEBUG=true` mostrando se RI oficial foi encontrado ou se houve fallback
- Não fazer ainda:
  - remover de uma vez o endpoint síncrono legado
  - reescrever a UI de polling para websocket neste lote
  - assumir que Bazin para ações sempre estará disponível sem validar o provider por ticker