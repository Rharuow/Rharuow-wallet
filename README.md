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
        Convidado vê convite no painel  ──────────►  /wallet/invite/[token]
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
| actionUrl | String? | Rota frontend para navegação ao clicar (ex: `/wallet/invite/:token`) |
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
   - **Canal e-mail:** enviar e-mail via `mailer` com link `{FRONTEND_URL}/wallet/invite/{token}`.
   - **Canal in-app:** se o e-mail convidado corresponder a um `User` cadastrado, criar `Notification` do tipo `WALLET_INVITE` para esse usuário com `actionUrl = /wallet/invite/{token}` e `metadata = { inviteId, ownerName }`.

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

##### 4. Página de aceite de convite via e-mail (`/wallet/invite/[token]`)

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

#### Backend / Banco de dados
- [ ] Criar migration com models `WalletInvite`, `WalletAccess` e `Notification` e enums `InviteStatus`, `WalletPermission` e `NotificationType`.
- [ ] Criar módulo `notifications` com endpoints de listagem, contagem, leitura e remoção.
- [ ] Criar módulo `wallet-sharing` com todos os endpoints listados.
- [ ] Implementar envio de e-mail de convite via `mailer` (template novo).
- [ ] Implementar criação de `Notification` in-app em todos os eventos do ciclo de convite (envio, aceite, recusa, revogação).
- [ ] Implementar middleware `checkWalletAccess` e aplicar nos módulos `costs` e `incomes`.
- [ ] Adaptar módulos `costs` e `incomes` para aceitar `ownerId` via contexto de acesso compartilhado.
- [ ] Implementar lógica de atualização automática de permissão ao fazer upgrade de plano (hook no módulo `payments`).
- [ ] Adicionar testes unitários e de integração para os módulos `wallet-sharing` e `notifications`.

#### Frontend
- [ ] Implementar componente `<NotificationBell />` com polling, drawer e ações inline de aceitar/recusar convite.
- [ ] Criar página `/dashboard/notificacoes` com listagem paginada e filtros.
- [ ] Criar página `/dashboard/compartilhamento` com abas de acessos concedidos e recebidos.
- [ ] Criar página pública `/wallet/invite/[token]` para aceite/recusa via link de e-mail.
- [ ] Implementar componente `<WalletSwitcher />` no header do dashboard.
- [ ] Implementar contexto/estado global para `activeOwnerId` (carteira ativa).
- [ ] Adaptar chamadas das páginas de Custos e Entradas para respeitar `activeOwnerId`.
- [ ] Ocultar/desabilitar módulos não permitidos para convidados FREE (Ações, FIIs, Saúde Financeira).
- [ ] Adicionar banner de contexto "Você está visualizando a carteira de X".

