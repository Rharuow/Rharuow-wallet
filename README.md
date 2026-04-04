# rharuowallet

> **Chega de não saber onde o seu dinheiro está indo.**

Você trabalha duro, investe com disciplina — mas na hora de responder "quanto eu tenho?" ou "estou evoluindo ou regredindo?", bate aquela dúvida, né? O **rharuowallet** existe para acabar com esse problema de vez.

É o seu escritório financeiro pessoal, disponível 24 horas por dia, direto no celular ou computador. Simples de usar, bonito de ver, e poderoso o suficiente para quem leva o dinheiro a sério.

---

### O que você ganha com o rharuowallet?

**Tudo no mesmo lugar, sem planilha, sem bagunça.**
Ações, FIIs, receitas, despesas — você enxerga tudo em um único painel organizado. Acabou aquela história de abrir cinco abas no navegador pra tentar montar um quadro da sua situação.

**Suas cotações sempre atualizadas, automaticamente.**
Não precisa ficar abrindo o Infomoney ou o Google Finance toda hora. O rharuowallet busca os preços do mercado pra você e atualiza sua carteira em tempo real.

**Descubra para onde o seu dinheiro vai — e pare de desperdiçar.**
Categorize suas despesas, veja seus ganhos e identifique de forma clara o que está pesando no seu bolso. Às vezes, um pequeno ajuste muda muito.

**Um assistente inteligente que conhece a sua carteira.**
Tem dúvida sobre seus investimentos? É só perguntar. O assistente do rharuowallet analisa os *seus* dados e responde com base na *sua* realidade — não em respostas genéricas da internet.

**Saúde financeira de verdade, não só saldo em conta.**
O sistema calcula indicadores objetivos que mostram se você está avançando em direção aos seus objetivos ou se precisa rever a rota. Como um check-up médico, mas para as suas finanças.

**Experimente sem compromisso.**
30 dias de acesso completo, sem pagar nada. Se gostar — e vai gostar — você escolhe o plano que melhor se encaixa no seu bolso. E se mudar de ideia, cancela quando quiser, sem burocracia.

---

> Não é sobre ser rico. É sobre saber onde você está e para onde está indo.
> O rharuowallet te dá essa clareza.

---

Monorepo para o MVP do rharuowallet — aplicação de carteira de investimento.

Resumo da arquitetura (MVP)
- Frontend: Next.js (apps/web) — hospedagem **Vercel**.
- Backend: Node.js + TypeScript (services/api) — hospedagem **Fly.io**.
- Banco relacional: **Supabase** (Postgres) — plano gratuito para MVP.
- Cache: **Upstash** (Redis) — para cache e locks.

Decisões importantes
- Iniciar com um backend único (monolito modular). Separar por serviços no futuro (auth, portfolio, ingest) se necessário.
- ORM recomendado: Prisma para tipagem e migrations.
- Jobs de ingestão B3: worker persistente no Fly.io ou agendamento via GitHub Actions para o MVP.
- Autenticação: Supabase Auth (rápido) ou NextAuth; suportar roles (`user`, `admin`).

Monorepo - layout recomendado
```
rharuowallet/
├─ apps/
│  └─ web/                # Next.js app (user-facing)
├─ services/
│  └─ api/                # Node + TypeScript API (modular)
├─ packages/
│  ├─ db/                 # Prisma schema, migrations, seeds
│  └─ common/             # types e utilitários compartilhados
├─ infra/                 # docker-compose, fly configs, terraform
├─ scripts/               # utilitários e scripts de suporte
└─ README.md
```

Conexões e pooling (observações operacionais)
- Para evitar exaustão de conexões no Postgres (planos grátis): usar pooling (PgBouncer) ou Neon/Supabase pooling nativo; em Node/Next reciclar o pool entre invocações.

Hosting e limites (MVP)
- Vercel: hospedagem do Next.js (frontend + API routes opcionais).
- Fly.io: hospedar o serviço Node persistente (API e workers) — trial disponível; verificar cotas.
- Supabase: banco Postgres + Auth + Storage (plano gratuito com limites de uso).
- Upstash: Redis serverless para cache/locks (plano gratuito).

Observability e DevOps
- CI: lint, build, test, migrations preview e deploy automatizado (Vercel para frontend, `flyctl` no CI para backend).
- Backups: configurar exportações regulares do Supabase.
- Secrets: usar `fly secrets` e variáveis de ambiente do Vercel; nunca commitar `.env`.

Guidelines para o agente Copilot (Claude Sonnet 4.6, modo agent)
- Contexto: este repositório contém o MVP do rharuowallet. Objetivo imediato: implementar a página de cadastro de usuários, ingestão de carteira via B3 e dashboard básico.
- Convenções: TypeScript estrito, Prisma para DB, testes unitários e integração mínima com DB em CI.
- Permissões: o agente pode criar/editar arquivos, adicionar scripts e gerar templates (README, Dockerfile, `fly.toml`, `package.json`, skeletons de Next/Express).
- Prioridades do agente:
  1. Estrutura do monorepo e docs (feito aqui).
  2. Implementar API de cadastro (auth + users).
  3. Implementar integração com B3 (adapter/worker).
  4. Criar dashboard front-end minimal.

Primeiros passos para dev local
1. Instalar dependências (recomendo `pnpm` ou `npm` com workspaces).

```bash
npm install
npm run bootstrap
```

2. Definir variáveis de ambiente (exemplo `.env` no `services/api`):

```
DATABASE_URL=postgres://...    # Supabase
UPSTASH_REDIS_URL=...         # Upstash
SUPABASE_URL=...
SUPABASE_KEY=...
JWT_SECRET=...
```

3. Rodar localmente (exemplo):

```bash
# rodar backend
cd services/api && npm run dev

# rodar frontend
cd apps/web && npm run dev
```

Checklist imediato para implementação (MVP)
- [x] Criar `apps/web` Next.js com página de cadastro.
- [x] Criar `services/api` com endpoints de auth/users (Prisma + migrations).
- [x] Configurar integração B3 (adapter) e job básico de ingestão.
- [x] Configurar deploy no Vercel (frontend) e Fly.io (backend).
- [x] **Fluxo de recuperação de senha por e-mail** — endpoint `POST /v1/auth/forgot-password` gera token com TTL e envia e-mail; endpoint `POST /v1/auth/reset-password` valida o token e atualiza a senha; páginas `/forgot-password` e `/reset-password` no frontend.

---

## Deploy de Produção

### Stack
| Camada | Plataforma | Obs |
|---|---|---|
| Frontend | Vercel | Deploy automático via Git |
| Backend | Fly.io | `flyctl deploy` |
| Banco | Supabase | Postgres gerenciado |
| Cache | Upstash | Redis serverless |

---

### Passo 1 — Banco de dados (Supabase)

1. Crie conta em [supabase.com](https://supabase.com) e crie um novo projeto.
2. Em **Project Settings → Database**, copie a **Connection String** (modo *Session* ou *Transaction pooler*):
   ```
   postgresql://postgres.[ref]:[password]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
   ```
3. Guarde essa string como `DATABASE_URL` — será usada no Fly.io.

---

### Passo 2 — Cache Redis (Upstash)

1. Crie conta em [upstash.com](https://upstash.com) → **Create Database** → escolha região **São Paulo**.
2. Copie **UPSTASH_REDIS_URL** e **UPSTASH_REDIS_TOKEN** do painel.

---

### Passo 3 — Backend (Fly.io)

```bash
# Instalar flyctl (se ainda não tiver)
curl -L https://fly.io/install.sh | sh
flyctl auth login

# Na raiz do monorepo:
cd /home/rharuow/project/rharuowallet

# Criar o app (somente na primeira vez)
flyctl apps create rharuowallet-api

# Configurar secrets
flyctl secrets set \
  DATABASE_URL="postgresql://postgres.[ref]:[password]@..." \
  JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")" \
  UPSTASH_REDIS_URL="https://..." \
  UPSTASH_REDIS_TOKEN="..." \
  BRAPI_TOKEN="..." \
  --app rharuowallet-api

# Deploy
flyctl deploy --app rharuowallet-api
```

> Após o deploy, a API estará em `https://rharuowallet-api.fly.dev`.
> Confirme que está respondendo: `curl https://rharuowallet-api.fly.dev/health`

---

### Passo 4 — Frontend (Vercel)

1. Acesse [vercel.com](https://vercel.com) → **Add New Project** → importe o repositório GitHub.
2. Vercel detecta o `vercel.json` na raiz e configura automaticamente `apps/web` como root.
3. Em **Environment Variables**, adicione:

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://rharuowallet-api.fly.dev` |
   | `BRAPI_TOKEN` | seu token da brapi.dev (opcional) |

4. Clique em **Deploy**. O domínio final será `https://rharuowallet.vercel.app`.

5. **Após obter o domínio Vercel**, atualize o CORS da API:
   ```bash
   flyctl secrets set CORS_ORIGIN="https://rharuowallet.vercel.app" --app rharuowallet-api
   ```

---

### Redeploy (atualizações futuras)

```bash
# Backend — a partir da raiz do monorepo
flyctl deploy --app rharuowallet-api

# Frontend — automático via push para a branch main no GitHub
git push origin main
```

---

Integração com dados de mercado (B3)

Decisão: brapi.dev

A API oficial da B3 não oferece acesso gratuito para desenvolvedores — os dados em tempo real são licenciados comercialmente para corretoras e provedores. Para o MVP, foi escolhida a **brapi.dev** (https://brapi.dev), que:
- É construída sobre dados oficiais da B3 com delay de ~15 minutos no plano gratuito;
- Suporta STOCK, FII, ETF e BDR;
- Fornece cotação atual, histórico OHLCV, dividendos e metadados do ativo;
- Plano gratuito: 30 requisições/minuto — suficiente para desenvolvimento e MVP.

Estratégia de cache com Redis (Upstash)

Para evitar atingir os limites do plano gratuito e reduzir latência, todas as consultas à brapi.dev passam pelo Redis antes de ir à API externa:

| Tipo de dado | TTL durante pregão (10h–17h55 BRT) | TTL fora do pregão |
|---|---|---|
| Cotação atual | 2 minutos | 30 minutos |
| Histórico de preços | 1 hora | 1 hora |
| Metadados do ativo | 24 horas | 24 horas |

Fluxo: `requisição → Redis (hit? retorna) → brapi.dev → salva no Redis → retorna`.

Variáveis de ambiente necessárias (brapi.dev)

```
BRAPI_TOKEN=       # Token gerado em https://brapi.dev/dashboard
BRAPI_BASE_URL=https://brapi.dev/api
```

Contatos e referências
- Supabase docs: https://supabase.com/docs
- Fly.io docs: https://fly.io/docs
- Upstash docs: https://upstash.com/docs
- Prisma docs: https://www.prisma.io/docs
- brapi.dev docs: https://brapi.dev/docs

---

## Gestão de Custos Domésticos

Funcionalidade que permite ao usuário registrar, categorizar e analisar seus custos domésticos por período (diário, semanal, mensal, etc.).

### Entidades

#### `CostArea` — Área de custo

Agrupa tipos de custo em grandes categorias. Existem 5 áreas globais (padrão do sistema, `userId = null`) e o usuário pode criar áreas personalizadas (visíveis, editáveis e deletáveis somente por ele).

| Campo | Tipo | Descrição |
|---|---|---|
| id | String (cuid) | Identificador único |
| name | String | Nome da área (ex: "Alimentação") |
| userId | String? | `null` = global; preenchido = área do usuário |
| deletedAt | DateTime? | Soft delete |

**Áreas globais padrão:** Alimentação, Educação, Lazer, Conforto, Saúde.

#### `CostType` — Tipo de custo

Subcategoria dentro de uma área. Criado pelo próprio usuário (ex: "Supermercado" dentro de "Alimentação").

| Campo | Tipo | Descrição |
|---|---|---|
| id | String (cuid) | Identificador único |
| name | String | Nome do tipo (ex: "Supermercado") |
| areaId | String | Área pai |
| userId | String | Dono do tipo |
| deletedAt | DateTime? | Soft delete |

#### `CostRecurrence` — Regra de recorrência

Descreve a periodicidade de um custo que se repete. Separada de `Cost` para não poluir registros avulsos com campos irrelevantes.

| Campo | Tipo | Descrição |
|---|---|---|
| unit | Enum | `DAY \| WEEK \| MONTH \| YEAR` |
| interval | Int | "a cada N unidades" (ex: interval=3, unit=MONTH → trimestral) |
| startDate | DateTime | Data da primeira ocorrência |
| nextDate | DateTime | Próxima data calculada pelo cron |
| maxOccurrences | Int? | Limite de repetições; `null` = indefinido |
| occurrenceCount | Int | Quantas vezes já foi gerado |
| isActive | Boolean | `false` = pausado/encerrado pelo usuário |

Exemplos de configuração:

| Frequência | unit | interval |
|---|---|---|
| Diária | DAY | 1 |
| Semanal | WEEK | 1 |
| Quinzenal | WEEK | 2 |
| Mensal | MONTH | 1 |
| Bimestral | MONTH | 2 |
| Trimestral | MONTH | 3 |
| Semestral | MONTH | 6 |
| Anual | YEAR | 1 |

#### `Cost` — Registro de custo

Um custo individual. Pode ser avulso ou gerado automaticamente por uma regra de recorrência.

| Campo | Tipo | Descrição |
|---|---|---|
| amount | Decimal | Valor do custo |
| description | String? | Descrição livre |
| date | DateTime | Data de ocorrência |
| userId | String | Dono (desnormalizado para queries de período eficientes) |
| costTypeId | String | Tipo do custo |
| recurrenceId | String? | Vínculo com regra de recorrência (`null` = avulso) |
| deletedAt | DateTime? | Soft delete |

### Diagrama de relacionamentos

```
User
 ├── CostArea (userId preenchido = personalizada)
 │       └── CostType
 │               ├── Cost  ←── recurrenceId ──┐
 │               └── CostRecurrence ──────────┘
 │                    (gera Cost periodicamente via cron)
 └── (relações diretas via userId em Cost e CostRecurrence)
```

### Soft delete e limpeza

- Todos os registros usam `deletedAt DateTime?`. Nenhuma query normal retorna registros com `deletedAt != null`.
- Um **cron job** executa periodicamente e faz `DELETE` físico (em cascade) de registros com `deletedAt < now() - 1 year`.
- Ao fazer soft delete de um `CostType`, todos os seus `Cost` e `CostRecurrence` também são soft-deletados imediatamente pela API.
- `CostArea` global (padrão) não pode ser deletada pelo usuário.

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/v1/costs/areas` | Lista áreas globais + personalizadas do usuário |
| POST | `/v1/costs/areas` | Cria área personalizada |
| PATCH | `/v1/costs/areas/:id` | Atualiza área personalizada |
| DELETE | `/v1/costs/areas/:id` | Soft delete de área personalizada |
| GET | `/v1/costs/types` | Lista tipos de custo do usuário (filtro por área) |
| POST | `/v1/costs/types` | Cria tipo de custo |
| PATCH | `/v1/costs/types/:id` | Atualiza tipo de custo |
| DELETE | `/v1/costs/types/:id` | Soft delete de tipo (cascateia para Cost e Recurrence) |
| GET | `/v1/costs` | Lista custos com filtros de data, área e tipo |
| POST | `/v1/costs` | Registra custo avulso |
| PATCH | `/v1/costs/:id` | Atualiza custo |
| DELETE | `/v1/costs/:id` | Soft delete de custo |
| GET | `/v1/costs/recurrences` | Lista regras de recorrência |
| POST | `/v1/costs/recurrences` | Cria regra de recorrência |
| PATCH | `/v1/costs/recurrences/:id` | Atualiza/pausa/retoma recorrência |
| DELETE | `/v1/costs/recurrences/:id` | Soft delete de recorrência |

---

## Próximas Funcionalidades (IA com OpenAI)

- [x] **Análise de Ativo (Stock/FII)** — Na página de detalhe de um ativo, a IA analisa fundamentos + dados de mercado e gera uma opinião contextualizada (premium).
- [x] **Budget Goals Suggestion** — A IA sugere metas de orçamento por área de custo com base no histórico e na renda do usuário (premium).
- [x] **Financial Health Score** — Relatório único combinando custos + entradas + investimentos: taxa de poupança, burn rate e projeção de runway (premium).
- [x] **Sugestão de Área e Descrição de Custo** — Ao registrar um custo, o usuário digita o tipo e a IA sugere automaticamente a melhor área e uma descrição padronizada com base no histórico e nas categorias existentes (premium).

---

## TODO — Créditos + Análise On-Demand de Relatórios (IA)

### Objetivo de produto

Criar uma camada de monetização complementar ao plano recorrente, permitindo que usuários `FREE` e `PREMIUM` comprem créditos na conta do RharouWallet e usem esse saldo em funcionalidades cobradas por consumo.

O primeiro caso de uso será:

- **Busca e análise de relatório de Ação/FII com IA**.
- A análise deve ser baseada no relatório do ativo, não apenas em dados resumidos de mercado.
- O acesso à análise deve durar **30 dias** para o usuário que a desbloqueou.
- Se a análise para o mesmo ativo já existir e ainda estiver válida, ela deve ser **reaproveitada** para reduzir custo operacional.

### Regras de negócio iniciais (MVP)

#### 1. Carteira de créditos

- Usuários `FREE` e `PREMIUM` podem adicionar crédito à conta.
- A recarga deve ser paga via Stripe.
- Valor de recarga: permitir valor livre **a partir de R$ 3,00**, com sugestão de presets no frontend para reduzir fricção (`R$ 5`, `R$ 10`, `R$ 20`, `R$ 50`).
- O crédito fica disponível como saldo interno e será consumido apenas em funcionalidades on-demand.

#### 2. Primeira feature on-demand

- Usuário informa um ticker de **ação** ou **FII**.
- O sistema tenta localizar automaticamente um relatório/documento-base para análise.
- Se encontrar o documento:
  - gera a análise com IA;
  - cobra do saldo do usuário;
  - concede acesso à análise por 30 dias.
- Se **não** encontrar o documento:
  - **não cobra** nada do usuário;
  - informa que o relatório não foi localizado automaticamente;
  - oferece fluxo de **upload manual** do relatório para análise posterior.

#### 3. Preço por análise

- Usuário `FREE`: **R$ 2,50** por análise.
- Usuário `PREMIUM`: **R$ 1,50** por análise.
- A cobrança acontece por desbloqueio de acesso à análise, não por número de visualizações dentro da janela de 30 dias.

#### 4. Reaproveitamento

- A análise deve ser reutilizada quando outro usuário pedir o mesmo ativo e a versão atual ainda estiver válida.
- O reaproveitamento deve considerar pelo menos:
  - ticker;
  - tipo do ativo (`STOCK` ou `FII`);
  - versão/fingerprint do documento usado;
  - janela de validade da análise.
- Mesmo quando houver reaproveitamento, o usuário continua pagando o preço do produto para obter acesso, mas a aplicação evita novo custo de OpenAI.

### Estratégia recomendada de busca do relatório

Para o MVP, a abordagem mais segura é em duas etapas:

1. **Busca automática primeiro**
   - Tentar localizar o relatório via busca web controlada ou scraping de fontes-alvo confiáveis.
   - O sistema só segue para geração de análise se localizar um documento utilizável.

2. **Upload manual como fallback**
   - Se a busca automática falhar, mostrar estado explícito de “relatório não encontrado”.
   - Permitir upload manual do PDF/documento para análise.

#### Recomendação técnica de busca

No MVP, evitar “busca web totalmente aberta” como única estratégia. O melhor custo-benefício é:

- tentar busca por consultas direcionadas por ticker + emissor + tipo de documento;
- priorizar fontes estáveis e previsíveis;
- extrair e salvar metadados mínimos do documento encontrado;
- só cobrar quando existir documento válido e a análise for concluída com sucesso.

Isso reduz falsos positivos, evita cobrança injusta e melhora a chance de cache/reaproveitamento.

### Estratégia de monetização e margem

#### Por que esse pricing é viável

- O custo de IA por análise tende a ser muito menor que o preço final cobrado, especialmente com modelo econômico e reaproveitamento.
- A margem melhora muito quando a mesma análise é servida para múltiplos usuários.
- O risco operacional principal não é o token da IA isoladamente, mas:
  - buscas malsucedidas;
  - retries;
  - parsing de documento;
  - custo Stripe sobre recargas pequenas.

#### Recomendação financeira do MVP

- Tratar recarga como **saldo pré-pago**, não como receita reconhecida no ato.
- Registrar todos os débitos e créditos em **ledger**.
- Cobrar apenas quando a análise estiver pronta ou quando o acesso reaproveitado for efetivamente concedido.
- Não debitar nada em caso de relatório não encontrado ou falha operacional da pipeline.

### Arquitetura proposta (MVP pé no chão)

#### 1. Créditos

Adicionar uma carteira interna simples de saldo com trilha de auditoria:

- `UserCreditBalance`
  - saldo atual do usuário;
  - atualização transacional.
- `CreditLedgerEntry`
  - entradas de crédito (recarga);
  - débitos de consumo (análise);
  - estornos/reversões.
- `CreditTopupOrder`
  - vínculo com sessão/checkout da Stripe;
  - status (`PENDING`, `PAID`, `FAILED`, `CANCELED`).

#### 2. Documento-fonte e análise reaproveitável

- `AssetReportSource`
  - identifica o documento-base usado na análise;
  - guarda URL original ou upload interno;
  - guarda fingerprint/hash para reaproveitamento.
- `AssetReportAnalysis`
  - resultado da análise gerada pela IA;
  - relação com ticker, tipo, source e data de geração;
  - pode ser reutilizada por vários usuários.
- `UserAssetReportAccess`
  - registra que um usuário pagou e possui acesso por 30 dias àquela análise.

#### 3. Regra de reaproveitamento

Fluxo recomendado:

1. Usuário solicita análise para um ticker.
2. Sistema procura análise reaproveitável válida para aquele ativo e documento atual.
3. Se existir:
   - debita preço do usuário (`FREE`/`PREMIUM`);
   - cria `UserAssetReportAccess` por 30 dias;
   - não chama OpenAI.
4. Se não existir:
   - tenta localizar documento;
   - gera análise;
   - salva a análise reaproveitável;
   - debita o usuário;
   - cria `UserAssetReportAccess`.
5. Se documento não for encontrado ou o pipeline falhar antes do sucesso:
   - não debita;
   - retorna estado de erro controlado/fallback de upload.

### Fluxo funcional do MVP

```text
Usuário escolhe ticker
        │
        ├──► Existe acesso ativo do usuário? ──► sim: abrir análise
        │
        └──► Não
               │
               ├──► Existe análise reaproveitável válida? ──► sim: debitar saldo + criar acesso
               │
               └──► Não
                      │
                      ├──► Buscar relatório automaticamente
                      │        │
                      │        ├──► encontrou: gerar análise IA -> salvar -> debitar -> criar acesso
                      │        │
                      │        └──► não encontrou: não cobrar + oferecer upload manual
                      │
                      └──► Falha operacional: não cobrar + registrar erro
```

### Escopo explícito do MVP

Entram no MVP:

- saldo pré-pago via Stripe;
- consulta por ticker de ação/FII;
- busca automática do relatório;
- análise com IA baseada no relatório;
- cobrança diferenciada por plano;
- acesso por 30 dias;
- reaproveitamento da análise;
- fallback de upload manual quando busca falhar.

Ficam fora do MVP inicial:

- múltiplos tipos de documento por ativo com escolha manual avançada;
- disputa/reembolso self-service no frontend;
- expiração automática de créditos promocionais;
- precificação dinâmica por tamanho do relatório;
- painel administrativo completo de auditoria financeira.

---

## TODO — Compartilhamento de Carteira

- [ ] **Compartilhamento de Carteira** — O dono da carteira pode convidar outro usuário (por e-mail ou pela própria aplicação) para acessar sua carteira. O convidado pode aceitar ou recusar via e-mail (link) ou diretamente pelo painel de notificações in-app. O nível de permissão depende do plano do convidado:
  - **Usuário convidado PREMIUM** → acesso total (CRUD) em custos, entradas e carteira de ativos, equivalente ao que o dono tem.
  - **Usuário convidado FREE** → acesso somente leitura em custos e entradas (sem acesso à carteira de ativos).
  - O dono pode revogar o acesso a qualquer momento, removendo imediatamente todas as permissões do convidado.

- [ ] **Sistema de Notificações In-App** — Infraestrutura de notificações necessária para suportar o compartilhamento de carteira e futuros eventos da plataforma. Cada notificação possui tipo, estado de leitura e, quando aplicável, ações diretas (aceitar/recusar convite sem sair da tela atual).

---

## Estratégia de Implementação — Compartilhamento de Carteira + Notificações

### Visão Geral do Fluxo

```
Dono envia convite
       │
       ├──► [por e-mail] mailer envia link  ──────────────────────────────────┐
       │                                                                       │
       └──► [in-app] Notification criada para o convidado                     │
                  │                                                            │
                  ▼                                                            ▼
        Sino de notificação acende            Convidado abre link no e-mail
        Convidado vê convite no painel  ──────────►  /convites/[token]
                  │                                          │
                  └──────────────────┬───────────────────────┘
                                     │
                              Aceita / Recusa
                                     │
                        ┌────────────┴────────────┐
                      Aceita                    Recusa
                        │                          │
               WalletAccess criado        WalletInvite.status = DECLINED
               (permissão = plan)         Notification marcada como lida
               Notification → lida
                        │
              Dono recebe notificação
              "Convite aceito por X"
                        │
       └── Dono revoga → WalletAccess removido
                         Notification para convidado: "Acesso revogado"
```

---

### Fase 1 — Banco de Dados (Prisma)

#### Novas models

**`WalletInvite`** — representa um convite emitido pelo dono da carteira.

| Campo | Tipo | Descrição |
|---|---|---|
| id | String (cuid) | Identificador único |
| ownerId | String | FK → User (dono da carteira) |
| guestEmail | String | E-mail do convidado |
| guestId | String? | FK → User (preenchido após aceite) |
| token | String (único) | Token seguro para o link do convite (e-mail) |
| status | Enum | `PENDING \| ACCEPTED \| DECLINED \| REVOKED` |
| expiresAt | DateTime | TTL do convite (ex: 7 dias) |
| createdAt | DateTime | — |
| updatedAt | DateTime | — |

**`WalletAccess`** — representa um acesso ativo à carteira de outro usuário.

| Campo | Tipo | Descrição |
|---|---|---|
| id | String (cuid) | Identificador único |
| ownerId | String | FK → User (dono da carteira) |
| guestId | String | FK → User (usuário com acesso) |
| inviteId | String (único) | FK → WalletInvite |
| permission | Enum | `READ \| FULL` |
| createdAt | DateTime | — |
| updatedAt | DateTime | — |

> Constraint única em `[ownerId, guestId]` para evitar acessos duplicados.

**`Notification`** — notificação in-app para qualquer evento da plataforma.

| Campo | Tipo | Descrição |
|---|---|---|
| id | String (cuid) | Identificador único |
| userId | String | FK → User (destinatário) |
| type | Enum | `WALLET_INVITE \| INVITE_ACCEPTED \| INVITE_DECLINED \| ACCESS_REVOKED \| GENERIC` |
| title | String | Título curto exibido no sino |
| body | String | Mensagem detalhada |
| read | Boolean | `false` = não lida |
| actionUrl | String? | Rota frontend para navegação ao clicar (ex: `/convites/:token`) |
| metadata | Json? | Dados extras contextuais (ex: `{ inviteId, ownerId }`) |
| createdAt | DateTime | — |

> `Notification` é independente de `WalletInvite` por design — o sistema de notificações deve ser reutilizável para outros eventos futuros (alertas de preço, metas de orçamento, etc.).

#### Novos Enums

```prisma
enum InviteStatus {
  PENDING
  ACCEPTED
  DECLINED
  REVOKED
}

enum WalletPermission {
  READ   // usuário FREE: leitura de custos e entradas
  FULL   // usuário PREMIUM: CRUD completo equivalente ao dono
}

enum NotificationType {
  WALLET_INVITE     // convidado recebeu um convite
  INVITE_ACCEPTED   // dono: convidado aceitou
  INVITE_DECLINED   // dono: convidado recusou
  ACCESS_REVOKED    // convidado: dono revogou o acesso
  GENERIC           // uso futuro
}
```

#### Regra de permissão na criação do `WalletAccess`

- Verificar o plano (`role`/`plan`) do convidado (`guestId`) no momento do aceite.
- Se `PREMIUM` → `permission = FULL`.
- Se `FREE` → `permission = READ`.
- Caso o convidado faça upgrade de FREE → PREMIUM posteriormente, a permissão deve ser atualizada para `FULL` automaticamente (via webhook do Stripe ou na próxima autenticação).

---

### Fase 2 — Backend (services/api)

#### Novo módulo: `notifications`

Localização sugerida: `services/api/src/modules/notifications/`

##### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/v1/notifications` | Lista notificações do usuário autenticado (paginado, mais recentes primeiro) |
| `GET` | `/v1/notifications/unread-count` | Retorna `{ count: number }` — usado para o badge do sino |
| `PATCH` | `/v1/notifications/:id/read` | Marca uma notificação como lida |
| `PATCH` | `/v1/notifications/read-all` | Marca todas como lidas |
| `DELETE` | `/v1/notifications/:id` | Remove uma notificação |

> **Polling vs. SSE:** para o MVP, o frontend faz polling no endpoint `unread-count` a cada 30 segundos. SSE/WebSocket pode ser adicionado futuramente sem quebrar a interface.

#### Novo módulo: `wallet-sharing`

Localização sugerida: `services/api/src/modules/wallet-sharing/`

##### Endpoints

| Método | Rota | Quem pode chamar | Descrição |
|---|---|---|---|
| `POST` | `/v1/wallet/invites` | Dono | Envia convite; cria `WalletInvite` + dispara e-mail + cria `Notification` para o convidado (se já for usuário cadastrado) |
| `GET` | `/v1/wallet/invites` | Dono | Lista convites enviados pelo dono (todos os status) |
| `GET` | `/v1/wallet/invites/received` | Convidado | Lista convites recebidos pelo usuário autenticado |
| `POST` | `/v1/wallet/invites/:token/accept` | Convidado | Aceita o convite; cria `WalletAccess`; cria `Notification` para o dono |
| `POST` | `/v1/wallet/invites/:token/decline` | Convidado | Recusa o convite; cria `Notification` para o dono |
| `DELETE` | `/v1/wallet/invites/:id` | Dono | Revoga convite; remove `WalletAccess`; cria `Notification` para o convidado |
| `GET` | `/v1/wallet/accesses` | Dono | Lista acessos ativos à carteira do dono |
| `GET` | `/v1/wallet/accesses/shared-with-me` | Convidado | Lista carteiras às quais o usuário tem acesso |

##### Lógica de negócio

1. **Envio do convite (`POST /v1/wallet/invites`)**
   - Validar se já existe convite `PENDING` para o mesmo `[ownerId, guestEmail]` → erro 409.
   - Gerar `token` com `crypto.randomBytes(32).toString('hex')`.
   - Definir `expiresAt = now + 7 dias`.
   - Salvar `WalletInvite` com `status = PENDING`.
  - **Canal e-mail:** enviar e-mail via `mailer` com link `{FRONTEND_URL}/convites/{token}`.
  - **Canal in-app:** se o e-mail convidado corresponder a um `User` cadastrado, criar `Notification` do tipo `WALLET_INVITE` para esse usuário com `actionUrl = /convites/{token}` e `metadata = { inviteId, ownerName }`.

2. **Aceite do convite (`POST /v1/wallet/invites/:token/accept`)**
   - Buscar convite pelo `token`; validar `status = PENDING` e `expiresAt > now`.
   - Verificar se já existe `WalletAccess` com mesmo `[ownerId, guestId]` → erro 409.
   - Verificar plano do convidado: `PREMIUM` → `FULL`, `FREE` → `READ`.
   - Criar `WalletAccess`; atualizar `WalletInvite.status = ACCEPTED` e `guestId`.
   - Marcar a `Notification` do tipo `WALLET_INVITE` relacionada como lida (se existir).
   - Criar `Notification` do tipo `INVITE_ACCEPTED` para o **dono** com `metadata = { guestName, guestEmail }`.

3. **Recusa do convite (`POST /v1/wallet/invites/:token/decline`)**
   - Atualizar `WalletInvite.status = DECLINED`.
   - Marcar `Notification` do convidado como lida.
   - Criar `Notification` do tipo `INVITE_DECLINED` para o **dono**.

4. **Revogação (`DELETE /v1/wallet/invites/:id`)**
   - Validar que o autenticado é o `ownerId`.
   - Atualizar `WalletInvite.status = REVOKED`; deletar `WalletAccess`.
   - Criar `Notification` do tipo `ACCESS_REVOKED` para o **convidado** com `metadata = { ownerName }`.

#### Middleware de autorização: `checkWalletAccess`

Plugin/hook Fastify que intercepta rotas que suportam acesso compartilhado.  
Assinatura: `checkWalletAccess(requestedOwnerId, authenticatedUserId)`

```
1. Se authenticatedUserId === requestedOwnerId → acesso total (dono).
2. Buscar WalletAccess onde ownerId = requestedOwnerId AND guestId = authenticatedUserId.
3. Se não encontrado → 403 Forbidden.
4. Se permission = READ e o método for POST/PATCH/DELETE → 403 Forbidden.
5. Se permission = FULL → acesso liberado como se fosse o dono.
```

#### Adaptação dos módulos existentes

Todos os endpoints que operam sobre dados de um usuário devem aceitar um `ownerId` opcional no contexto (enviado pelo header `X-Wallet-Owner` ou query param `ownerId`), substituindo o `userId` do JWT para fins de busca de dados — mas **nunca** para criação de registros sem validação de permissão.

Módulos impactados: `costs`, `incomes`.  
Módulos **não** expostos para usuários FREE: `portfolio`, `stocks`, `fiis`.

---

### Fase 3 — Frontend (apps/web)

#### Novas páginas e componentes

##### 1. Componente `<NotificationBell />` (header global do dashboard)

- Ícone de sino com badge numérico de não lidas (polling em `GET /v1/notifications/unread-count` a cada 30s).
- Ao clicar: drawer/popover lateral com lista das notificações mais recentes.
- Cada item exibe: ícone por tipo, título, corpo, tempo relativo ("há 5 min").
- Notificações do tipo `WALLET_INVITE` exibem botões **"Aceitar"** e **"Recusar"** inline, sem redirecionar.
  - Ao aceitar inline: chama `POST /v1/wallet/invites/:token/accept` e atualiza a lista.
  - Ao recusar inline: chama `POST /v1/wallet/invites/:token/decline` e remove da lista.
- Link "Ver todas" leva para `/dashboard/notificacoes`.
- Marcar como lida ao clicar em qualquer notificação (`PATCH /v1/notifications/:id/read`).

##### 2. Página `/dashboard/notificacoes`

- Lista paginada de todas as notificações do usuário.
- Filtro por tipo e por status (lidas/não lidas).
- Botão "Marcar todas como lidas".
- Opção de deletar notificações individuais.

##### 3. Página de gerenciamento de compartilhamentos (`/dashboard/compartilhamento`)

- **Aba "Acessos concedidos"** (visão do dono):
  - Tabela com convidados: e-mail, status, permissão, data.
  - Botão "Revogar" por linha (chama `DELETE /v1/wallet/invites/:id`).
  - Formulário "Convidar usuário": campo e-mail + botão "Enviar convite".
  - Indicação visual se o convidado é usuário cadastrado (convite in-app também enviado) ou externo (somente e-mail).

- **Aba "Carteiras compartilhadas comigo"** (visão do convidado):
  - Lista de carteiras às quais o usuário tem acesso.
  - Indicador visual de nível de acesso: `Leitura` ou `Completo`.
  - Convites `PENDING` exibem botões "Aceitar" e "Recusar" (mesma ação do sino).
  - Botão "Acessar carteira" para acessos aceitos.

##### 4. Página de aceite de convite via e-mail (`/convites/[token]`)

- Página pública (redireciona para login se não autenticado, preservando o token na URL de retorno).
- Exibe: nome/e-mail do dono da carteira, nível de permissão que o convidado receberá com base no seu plano atual.
- Botões: "Aceitar" e "Recusar".
- Após aceite → redirecionar para `/dashboard` com o contexto da carteira compartilhada.
- Exibe mensagem de erro amigável se o token estiver expirado ou já utilizado, com opção de solicitar novo convite.

##### 5. Seletor de carteira no Dashboard (`<WalletSwitcher />`)

- Dropdown no header do dashboard.
- Exibe "Minha carteira" por padrão.
- Lista as carteiras compartilhadas com o usuário (de `GET /v1/wallet/accesses/shared-with-me`).
- Ao selecionar uma carteira externa: persiste o `ownerId` no estado global (Zustand/Context) e adiciona header `X-Wallet-Owner` nas chamadas à API.
- Banner de contexto: "Você está visualizando a carteira de **[Nome do Dono]**" com botão "Voltar para minha carteira".
- Para convidados FREE: desabilitar/ocultar os menus de Ações, FIIs e Saúde Financeira; exibir apenas Custos e Entradas.

##### 6. `PremiumGate` nas operações de escrita (carteira compartilhada)

- Ao tentar criar/editar/deletar em uma carteira compartilhada com `permission = READ`, exibir modal informando que é necessário o plano Premium para ter acesso de edição.

---

### Diagrama de Relacionamentos (novos modelos)

```
User (dono)
 └── WalletInvite
       ├── guestEmail
       ├── guestId ──────────► User (convidado)
       ├── status (PENDING|ACCEPTED|DECLINED|REVOKED)
       └── WalletAccess
             ├── permission (READ|FULL)
             ├── ownerId ───► User (dono)
             └── guestId ───► User (convidado)

User (qualquer)
 └── Notification[]
       ├── type (WALLET_INVITE|INVITE_ACCEPTED|INVITE_DECLINED|ACCESS_REVOKED|GENERIC)
       ├── read (Boolean)
       ├── actionUrl (opcional — rota frontend)
       └── metadata (Json — contexto do evento)
```

---

### Checklist de Implementação

### Status Atual

- [x] Lote 1 concluído em backend: banco, módulo `wallet-sharing`, autorização compartilhada, sync de permissão no upgrade e testes de integração.
- [x] Lote 2 concluído: frontend MVP entregue e fluxo crítico validado com E2E dedicado de convite, troca de contexto e bloqueio pós-revogação.
- [x] Lote 3 concluído: notificações in-app e hardening final validados com integração e E2E.

#### Backend / Banco de dados
- [x] Criar migration com models `WalletInvite`, `WalletAccess` e enums `InviteStatus`, `WalletPermission`.
- [x] Criar migration de `Notification` e enum `NotificationType`.
- [x] Criar módulo `notifications` com endpoints de listagem, contagem, leitura e remoção.
- [x] Criar módulo `wallet-sharing` com endpoints do MVP do Lote 1.
- [x] Implementar envio de e-mail de convite via `mailer` (template novo).
- [x] Implementar criação de `Notification` in-app em todos os eventos do ciclo de convite (envio, aceite, recusa, revogação).
- [x] Implementar middleware `checkWalletAccess` e aplicar nos módulos `costs` e `incomes`.
- [x] Adaptar módulos `costs` e `incomes` para aceitar `ownerId` via contexto de acesso compartilhado.
- [x] Implementar lógica de atualização automática de permissão ao fazer upgrade de plano (hook no módulo `payments`).
- [x] Adicionar testes de integração para o módulo `wallet-sharing` e os guardas de acesso compartilhado.
- [x] Adicionar testes para o módulo `notifications`.

#### Frontend
- [x] Implementar componente `<NotificationBell />` com polling, drawer e ações inline de aceitar/recusar convite.
- [x] Criar página `/dashboard/notificacoes` com listagem paginada e filtros.
- [x] Criar página `/dashboard/compartilhamento` com abas de acessos concedidos e recebidos.
- [x] Criar página pública `/convites/[token]` para aceite/recusa via link de e-mail.
- [x] Implementar componente `<WalletSwitcher />` no header do dashboard.
- [x] Implementar contexto/estado global para `activeOwnerId` (carteira ativa).
- [x] Adaptar chamadas das páginas de Custos e Entradas para respeitar `activeOwnerId`.
- [x] Ocultar/desabilitar módulos não permitidos para convidados FREE (Ações, FIIs, Saúde Financeira).
- [x] Adicionar banner de contexto "Você está visualizando a carteira de X".

---

## Recorte de MVP (Pé no Chão)

Objetivo: colocar compartilhamento de carteira em produção com risco controlado, priorizando fluxo principal e segurança de autorização.

### Escopo mínimo (entra no MVP)

1. Convite por e-mail com token e expiração.
2. Aceite e recusa por link (`/convites/[token]`).
3. Criação de acesso compartilhado após aceite.
4. Permissão baseada no plano do convidado:
  - PREMIUM -> `FULL`.
  - FREE -> `READ` (somente leitura em custos e entradas).
5. Revogação imediata pelo dono.
6. Seletor simples de carteira no dashboard (`Minha carteira` x `Carteira compartilhada`).
7. Suporte a `ownerId` somente nos módulos `costs` e `incomes`.
8. Atualização de permissão `READ -> FULL` no upgrade de plano (webhook Stripe).

### Fora do MVP (Fase seguinte)

1. NotificationBell global e unread count.
2. Página completa de notificações com filtros e ações inline.
3. Melhorias visuais avançadas (tempo relativo, ícones por tipo, UX refinada).

### Critérios de aceite do MVP

1. Dono envia convite e não consegue criar convite pendente duplicado para o mesmo e-mail.
2. Convidado aceita com token válido e passa a enxergar a carteira do dono.
3. Token expirado, inválido ou já usado retorna erro amigável.
4. Convidado FREE recebe 403 em `POST/PATCH/DELETE` de custos/entradas na carteira compartilhada.
5. Convidado PREMIUM consegue CRUD de custos/entradas na carteira compartilhada.
6. Revogação remove acesso imediatamente e bloqueia novas leituras/escritas.
7. Sem `ownerId` autorizado, a API retorna 403 e não vaza dados.
8. Fluxos atuais de carteira própria continuam sem regressão.

---

## Plano de Entrega - Lote 1 (Banco + API + Segurança)

Foco do lote: deixar o backend pronto, seguro e testado para o frontend plugar sem retrabalho.

Status: concluído.

### Escopo do Lote 1

1. Migration Prisma:
  - `WalletInvite`, `WalletAccess`.
  - Enums `InviteStatus`, `WalletPermission`.
  - Índices/constraints (`token` único e `[ownerId, guestId]` único).
2. Módulo `wallet-sharing` com endpoints:
  - `POST /v1/wallet/invites`
  - `GET /v1/wallet/invites`
  - `GET /v1/wallet/invites/received`
  - `POST /v1/wallet/invites/:token/accept`
  - `POST /v1/wallet/invites/:token/decline`
  - `DELETE /v1/wallet/invites/:id`
  - `GET /v1/wallet/accesses`
  - `GET /v1/wallet/accesses/shared-with-me`
3. Envio de e-mail de convite com link de aceite/recusa.
4. Middleware `checkWalletAccess`.
5. Adaptação de `costs` e `incomes` para `ownerId` via contexto (`X-Wallet-Owner`).
6. Upgrade de permissão no webhook Stripe (FREE -> PREMIUM atualiza para `FULL`).

### Plano de execução sugerido (ordem)

1. Criar schema + migration e validar Prisma Client.
2. Implementar camada de serviço do `wallet-sharing` com regras de domínio.
3. Expor rotas Fastify + validações de payload/params.
4. Integrar mailer e templates de convite.
5. Implementar `checkWalletAccess`.
6. Aplicar middleware em `costs` e `incomes`.
7. Integrar atualização de permissão no webhook de pagamentos.
8. Fechar com testes de integração e ajustes de polimento.

### Testes de integração robustos (obrigatórios no Lote 1)

1. `invite-create.spec`:
  - cria convite com sucesso;
  - bloqueia duplicado pendente (409).
2. `invite-accept.spec`:
  - aceita convite válido e cria `WalletAccess`;
  - define `permission` correta por plano;
  - bloqueia token expirado/inválido/já utilizado.
3. `invite-decline.spec`:
  - recusa convite e atualiza status.
4. `invite-revoke.spec`:
  - dono revoga e remove acesso ativo.
5. `shared-read-write-guards.spec`:
  - convidado FREE pode GET e não pode POST/PATCH/DELETE;
  - convidado PREMIUM pode operações de escrita.
6. `ownerid-forgery.spec`:
  - usuário sem acesso tenta `X-Wallet-Owner` e recebe 403.
7. `plan-upgrade-sync.spec`:
  - upgrade via webhook promove `READ` para `FULL`.

### Polimento mínimo (ainda no Lote 1)

1. Erros padronizados com mensagens claras (`INVITE_EXPIRED`, `INVITE_ALREADY_USED`, `ACCESS_DENIED`).
2. Logs de auditoria para eventos de convite (envio, aceite, recusa, revogação).
3. Sanitização de e-mail e normalização para evitar duplicidade por case.
4. Idempotência na revogação (segunda chamada não quebra fluxo).
5. Documentação rápida de endpoints e exemplos de resposta.

### Definition of Done (Lote 1)

1. Endpoints do `wallet-sharing` funcionando em ambiente local.
2. `costs` e `incomes` protegidos por autorização compartilhada.
3. Convite por e-mail funcionando com token expirável.
4. Upgrade de plano atualiza permissão existente.
5. Testes de integração principais passando no CI/local.
6. Sem regressão nos endpoints já existentes de custos e entradas.

---

## Plano de Entrega - Lote 2 (Frontend MVP + Integração E2E)

Foco do lote: plugar o frontend ao backend do Lote 1 e entregar o fluxo ponta a ponta de compartilhamento com UX simples e consistente.

Status: concluído no frontend MVP, com suíte E2E dedicada cobrindo o fluxo crítico de convite, aceite por link, troca de contexto e bloqueio pós-revogação (`L2-08`).

### Escopo do Lote 2

1. Página de aceite/recusa via token: `/convites/[token]`.
2. Página de gestão de compartilhamento no dashboard: envio de convite, listagem e revogação.
3. `WalletSwitcher` no dashboard com estado de carteira ativa (`ownerId`).
4. Propagação de `X-Wallet-Owner` nas chamadas de `costs` e `incomes`.
5. Restrição visual e funcional para convidado FREE (somente leitura em custos/entradas).
6. Banner de contexto para indicar carteira ativa (dono atual selecionado).

### Plano de execução sugerido (ordem)

1. Implementar estado global de carteira ativa e persistência básica em sessão.
2. Adaptar camada de API para injetar `X-Wallet-Owner` quando aplicável.
3. Criar página `/dashboard/compartilhamento` com enviar convite/listar/revogar.
4. Criar página `/convites/[token]` com fluxo de login e retorno.
5. Implementar `WalletSwitcher` e banner de contexto no shell do dashboard.
6. Aplicar bloqueios de escrita para convidado FREE nas telas de custos/entradas.
7. Fechar com testes de integração frontend-backend e polimento de UX.

### Testes de integração robustos (obrigatórios no Lote 2)

Suíte implementada nesta etapa:

1. `wallet-sharing.e2e`:
  - usuário não autenticado abre o link do convite, faz login e retorna ao fluxo;
  - aceite por link ativa a carteira compartilhada no contexto correto;
  - alternância entre carteira compartilhada e carteira própria reflete os dados corretos;
  - revogação pelo dono remove o acesso e bloqueia o contexto previamente ativo.

2. `invite-link-flow.e2e`:
  - usuário autenticado abre token válido e aceita convite;
  - usuário não autenticado é redirecionado para login e retorna ao fluxo.
3. `wallet-switcher-context.e2e`:
  - alternar carteira muda dados de `costs` e `incomes`;
  - voltar para "Minha carteira" restaura dados próprios.
4. `free-readonly-ui.e2e`:
  - convidado FREE não vê ações de escrita ou recebe bloqueio com feedback claro.
5. `premium-write-ui.e2e`:
  - convidado PREMIUM consegue executar escrita em custos/entradas.
6. `revoke-live-block.e2e`:
  - após revogação, novas chamadas da carteira compartilhada passam a falhar com 403.

### Polimento mínimo (ainda no Lote 2)

1. Mensagens amigáveis para token expirado/inválido/já usado.
2. Loading e estados vazios nas páginas de convite e compartilhamento.
3. Tratamento de erro de rede com retry manual (botão "Tentar novamente").
4. Texto de contexto explícito: "Você está visualizando a carteira de X".
5. Consistência visual com componentes existentes do dashboard.

### Definition of Done (Lote 2)

1. Fluxo completo convite -> aceite -> acesso compartilhado funcional via UI.
2. Alternância de carteira estável com dados corretos por contexto.
3. Regras FREE/PREMIUM refletidas na interface e confirmadas por teste.
4. Revogação refletida no frontend sem inconsistência de estado.
5. Testes E2E críticos passando local/CI.

---

## Plano de Entrega - Lote 3 (Notificações + Hardening + Polimento Final)

Foco do lote: completar a experiência com notificações in-app e elevar robustez operacional antes de considerar a feature finalizada.

Status: concluído.

### Escopo do Lote 3

1. Model e módulo `notifications` no backend.
2. Endpoint de listagem, contagem de não lidas, marcar lida, marcar todas e remoção.
3. Criação de notificações para eventos do ciclo de convite (enviado, aceito, recusado, revogado).
4. `NotificationBell` no dashboard com badge e polling.
5. Página `/dashboard/notificacoes` com listagem e ações básicas.
6. Hardening técnico: auditoria, observabilidade, cobertura de testes e documentação final.

### Plano de execução sugerido (ordem)

1. Implementar schema/serviço/rotas de notificações no backend.
2. Integrar disparos de notificação nos eventos de `wallet-sharing`.
3. Implementar `NotificationBell` com polling de `unread-count`.
4. Criar página `/dashboard/notificacoes` e ações de leitura.
5. Melhorar logs, métricas e tratamento de erros operacionais.
6. Fechar regressão geral e documentação final.

### Testes de integração robustos (obrigatórios no Lote 3)

1. `notification-lifecycle.spec`:
  - criação de notificação em eventos de convite;
  - mudança de estado `read=false -> true`.
2. `unread-count-consistency.spec`:
  - contador reflete marcação individual e "marcar todas".
3. `invite-event-notifications.spec`:
  - dono recebe notificação em aceite/recusa;
  - convidado recebe notificação em revogação.
4. `notification-auth-boundary.spec`:
  - usuário não acessa notificações de terceiros.
5. `regression-wallet-sharing.e2e`:
  - fluxo do Lote 2 permanece íntegro após adicionar notificações.

### Polimento final (Lote 3)

1. Normalização de payload de erro em todos os endpoints novos.
2. Logs estruturados com `requestId`, `ownerId`, `guestId`, `inviteId` quando aplicável.
3. Índices revisados para consultas de listagem e unread count.
4. Revisão de segurança para evitar enumeração de convites/tokens.
5. Documentação final do fluxo com exemplos de requests/responses.

### Definition of Done (Lote 3)

1. Notificações in-app funcionais para todo o ciclo de compartilhamento.
2. Sino e página de notificações estáveis no frontend.
3. Fluxos dos Lotes 1 e 2 sem regressões relevantes.
4. Cobertura de integração/E2E consolidada para cenários críticos.
5. Observabilidade e documentação suficientes para operação em produção.

---

## Backlog Executável (Lotes 1, 2 e 3)

Legenda de prioridade:
- `P0` = bloqueante para MVP.
- `P1` = essencial para completar lote.
- `P2` = melhoria importante, mas não bloqueante do fluxo principal.

Legenda de estimativa:
- `XS` (0,5 dia), `S` (1 dia), `M` (2 dias), `L` (3 dias).

### Lote 1 - Banco + API + Segurança

| Ticket | Status | Prioridade | Dependências | Estimativa | Entrega objetiva |
|---|---|---|---|---|---|
| `L1-01` Migration wallet sharing | Concluído | P0 | — | S | Criar `WalletInvite`, `WalletAccess`, enums e índices/constraints no Prisma |
| `L1-02` Serviço de domínio de convites | Concluído | P0 | `L1-01` | M | Implementar regras de criar/aceitar/recusar/revogar convite com validações de status e expiração |
| `L1-03` Rotas Fastify wallet-sharing | Concluído | P0 | `L1-02` | M | Expor endpoints do módulo com validação de payload/params e respostas padronizadas |
| `L1-04` Mailer de convite | Concluído | P1 | `L1-03` | S | Disparar e-mail com link `/convites/:token` e template de convite |
| `L1-05` Middleware checkWalletAccess | Concluído | P0 | `L1-02` | S | Autorizar acesso por `ownerId` e bloquear escrita quando `READ` |
| `L1-06` Aplicar ownerId em costs | Concluído | P0 | `L1-05` | M | Adaptar rotas/serviços de custos para contexto compartilhado com `X-Wallet-Owner` |
| `L1-07` Aplicar ownerId em incomes | Concluído | P0 | `L1-05` | M | Adaptar rotas/serviços de entradas para contexto compartilhado com `X-Wallet-Owner` |
| `L1-08` Sync de permissão no upgrade | Concluído | P1 | `L1-01` | S | Atualizar `WalletAccess.permission` para `FULL` em upgrade FREE -> PREMIUM no webhook |
| `L1-09` Testes integração wallet-sharing | Concluído | P0 | `L1-03`, `L1-05`, `L1-06`, `L1-07` | L | Cobrir criação, aceite, recusa, revogação, forja de ownerId e guardas READ/FULL |
| `L1-10` Polimento e padronização de erro | Concluído | P1 | `L1-09` | S | Códigos de erro consistentes, logs de auditoria e idempotência em revogação |

### Lote 2 - Frontend MVP + Integração E2E

| Ticket | Status | Prioridade | Dependências | Estimativa | Entrega objetiva |
|---|---|---|---|---|
| `L2-01` Estado global da carteira ativa | Concluído | P0 | `L1-06`, `L1-07` | S | Criar `activeOwnerId` com persistência em sessão |
| `L2-02` Header X-Wallet-Owner no client API | Concluído | P0 | `L2-01` | S | Injetar `X-Wallet-Owner` automaticamente nas chamadas elegíveis |
| `L2-03` Página compartilhamento dashboard | Concluído | P0 | `L1-03`, `L2-02` | M | Tela para enviar convite, listar enviados e revogar acesso |
| `L2-04` Página pública de convite por token | Concluído | P0 | `L1-03` | M | Implementar `/convites/[token]` com aceitar/recusar e tratamento de autenticação |
| `L2-05` WalletSwitcher no dashboard | Concluído | P0 | `L2-01`, `L1-03` | M | Alternar entre minha carteira e carteiras compartilhadas comigo |
| `L2-06` Banner de contexto de carteira | Concluído | P1 | `L2-05` | XS | Exibir dono ativo e ação para voltar para minha carteira |
| `L2-07` Guardas de UI para FREE | Concluído | P0 | `L2-05`, `L1-05` | S | Bloquear ações de escrita e esconder módulos não permitidos |
| `L2-08` E2E fluxo convite e troca de contexto | Concluído | P0 | `L2-03`, `L2-04`, `L2-05`, `L2-07` | L | Cobrir aceite por link, alternância de carteira e bloqueio pós-revogação |
| `L2-09` Polimento UX de erro/loading | Concluído | P1 | `L2-08` | S | Estados vazios, retry e mensagens amigáveis de token |

### Lote 3 - Notificações + Hardening + Polimento Final

| Ticket | Prioridade | Dependências | Estimativa | Entrega objetiva |
|---|---|---|---|---|
| `L3-01` Migration e model de notifications | P0 | — | S | Criar model `Notification` e enum `NotificationType` |
| `L3-02` Serviço e rotas de notifications | P0 | `L3-01` | M | Endpoints de listagem, unread-count, marcar lida, marcar todas e delete |
| `L3-03` Emitir notificações no ciclo de convite | P0 | `L3-02`, `L1-03` | M | Criar notificações para envio, aceite, recusa e revogação |
| `L3-04` NotificationBell no dashboard | P1 | `L3-02`, `L3-03` | M | Badge com polling e listagem resumida |
| `L3-05` Página de notificações | P1 | `L3-02` | M | Implementar `/dashboard/notificacoes` com ações de leitura |
| `L3-06` Integração de ações inline convite | P1 | `L3-04`, `L1-03` | S | Aceitar/recusar convite direto no painel de notificações |
| `L3-07` Testes integração notifications | P0 | `L3-03`, `L3-05` | M | Cobrir lifecycle, unread-count e fronteira de autenticação |
| `L3-08` Regressão E2E cross-lotes | P0 | `L3-07`, `L2-08` | M | Garantir que notificações não quebram fluxo de compartilhamento |
| `L3-09` Hardening operacional | P1 | `L3-08` | S | Logs estruturados, revisão de índices e documentação final de operação |

### Lote 4 - Créditos + Análise On-Demand de Relatórios

Status: concluído.

| Ticket | Prioridade | Dependências | Estimativa | Entrega objetiva |
|---|---|---|---|---|
| `L4-01` Modelagem Prisma de créditos | P0 | — | M | Criar `UserCreditBalance`, `CreditLedgerEntry` e `CreditTopupOrder` com índices e status |
| `L4-02` Modelagem Prisma de análise reaproveitável | P0 | — | M | Criar `AssetReportSource`, `AssetReportAnalysis` e `UserAssetReportAccess` |
| `L4-03` Checkout Stripe de recarga | P0 | `L4-01` | M | Permitir criação de checkout para top-up a partir de R$ 3,00 |
| `L4-04` Confirmação de pagamento + crédito | P0 | `L4-03` | M | Creditar saldo via webhook Stripe com idempotência e ledger |
| `L4-05` Serviço de saldo e extrato | P1 | `L4-01`, `L4-04` | S | Endpoints para consultar saldo e histórico de movimentações |
| `L4-06` Busca automática de relatório | P0 | `L4-02` | M | Pipeline para localizar documento-base por ticker sem cobrar em caso de falha |
| `L4-07` Upload manual de relatório | P1 | `L4-02` | M | Permitir fallback de upload quando busca automática não encontrar documento |
| `L4-08` Serviço de análise com cache/reuso | P0 | `L4-02`, `L4-06` | L | Reutilizar análise existente por ticker + fingerprint antes de chamar OpenAI |
| `L4-09` Regra de cobrança por plano | P0 | `L4-01`, `L4-08` | S | Debitar R$ 2,50 (`FREE`) e R$ 1,50 (`PREMIUM`) apenas em sucesso |
| `L4-10` Controle de acesso por 30 dias | P0 | `L4-02`, `L4-09` | S | Conceder acesso temporário à análise para o usuário pagante |
| `L4-11` UI de créditos no dashboard | P1 | `L4-05` | M | Tela de saldo, recarga e extrato simples |
| `L4-12` UI de consulta/análise de relatório | P0 | `L4-06`, `L4-08`, `L4-10` | L | Busca por ticker, estados de loading/erro, fallback de upload e leitura da análise |
| `L4-13` Testes integração financeiro + análise | P0 | `L4-04`, `L4-08`, `L4-09`, `L4-10` | L | Cobrir crédito, débito, não-cobrança em falha e reaproveitamento |
| `L4-14` E2E do fluxo on-demand | P1 | `L4-11`, `L4-12`, `L4-13` | L | Cobrir recarga, compra da análise, acesso posterior e fallback sem cobrança |
| `L4-15` Hardening operacional | P1 | `L4-13` | S | Logs, auditoria mínima, proteção contra dupla cobrança e documentação final |

### Sequência recomendada para execução

1. Entregar todos os `P0` do Lote 1.
2. Fechar `L1-09` antes de iniciar telas do Lote 2.
3. Entregar `P0` do Lote 2 e validar E2E mínimo (`L2-08`).
4. Implementar `P0` do Lote 3 e rodar regressão cruzada (`L3-08`).
5. Implementar `P0` do Lote 4 em ordem: `L4-01` -> `L4-04` -> `L4-06` -> `L4-10`.
6. Finalizar com `P1` de polimento em ordem: `L1-10` -> `L2-09` -> `L3-09` -> `L4-15`.

### Documentação operacional por feature

- Template base para novas features: `docs/features/_template.md`
- Documento operacional do Lote 4: `docs/features/lote-4-creditos-relatorios.md`
- Regra de manutenção: sempre atualizar primeiro `Status atual` e `Próximo passo exato` no documento da feature antes de iniciar a próxima etapa.

### Marco de release (go/no-go)

Release MVP aprovado quando:
1. Todos os tickets `P0` dos Lotes 1 e 2 estão concluídos.
2. `L1-09` e `L2-08` estão verdes no CI.
3. Não há bug crítico aberto de autorização ou vazamento de dados.

Release completo aprovado quando:
1. Todos os tickets `P0` e `P1` dos Lotes 1, 2 e 3 estão concluídos.
2. `L3-07` e `L3-08` estão verdes no CI.
3. Observabilidade mínima e documentação operacional estão atualizadas.

Release da feature de créditos aprovado quando:
1. Todos os tickets `P0` do Lote 4 estão concluídos.
2. Não existe cenário de dupla cobrança conhecido em top-up ou débito de análise.
3. Reaproveitamento de análise e acesso de 30 dias estão cobertos por teste.
4. Fluxos “relatório não encontrado” e “falha antes da geração” não cobram o usuário.
5. Fallback manual e acesso posterior estão validados por E2E dedicado.

