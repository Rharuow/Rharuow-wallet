# Lote 5 - Relatórios Assíncronos e Busca Web Controlada

## Objetivo de produto

Evoluir a experiencia de relatorios on-demand para um modelo assincrono, com acompanhamento de status pelo usuario, busca automatica de documentos na web com controle de custo e validacao de uploads manuais antes da analise final.

## Status atual

- Estado: `in-progress`
- Lote atual: `hardening pós-MVP`
- Última atualização: `2026-04-04`

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

## Modelagem de dados

- Novo job de processamento assincrono de relatorio.
- Novo registro de cooldown por ativo para busca automatica.
- Evolucao da origem do relatorio para registrar metodo de descoberta e validacao.

## Endpoints e contratos

Planejados para esta evolucao:

- `POST /v1/reports/jobs`
- `POST /v1/reports/jobs/manual`
- `GET /v1/reports/jobs`
- `GET /v1/reports/jobs/:id`

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

## Pendências e riscos

- Idempotencia do worker precisa impedir cobranca duplicada em reprocessamento Kafka.
- Busca web via OpenAI ainda precisa de limite operacional, metricas por ativo e observabilidade dedicada.
- Validacao manual atual usa heuristica por ticker/nome e ainda pode precisar reforco para casos ambíguos.
- A UI usa polling simples; se o volume crescer, convem migrar para estratégia incremental ou eventos.

## Próximo passo exato

- Ticket a executar: `Hardening pós-MVP`
- Objetivo técnico: reforçar idempotência do worker, telemetria da busca web e guardrails operacionais do pipeline.
- Arquivos prováveis:
  - `services/api/src/modules/reports/report-jobs.processor.ts`
  - `services/api/src/modules/reports/report-jobs.service.ts`
  - `services/api/src/workers/report-analysis-worker.ts`
- Testes mínimos esperados:
  - reprocessamento do mesmo job sem débito duplicado
  - métricas/counters para fallback web e falhas por ticker
  - garantia de transição terminal consistente no worker
- Não fazer ainda:
  - remover de uma vez o endpoint síncrono legado
  - introduzir websocket antes de necessidade operacional real