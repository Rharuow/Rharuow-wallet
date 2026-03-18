# rharuowallet

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

