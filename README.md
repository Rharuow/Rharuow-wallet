# rharuowallet

Monorepo para o MVP do rharuowallet — aplicação de carteira de investimento.

Resumo da arquitetura (MVP)
- Frontend: Next.js (apps/web) — hospedagem Vercel.
- Backend: Node.js + TypeScript (services/api) — hospedagem Fly.io.
- Banco relacional: Supabase (Postgres) — plano gratuito para MVP.
- Cache: Upstash (Redis) — para cache e locks.

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
- [ ] Criar `apps/web` Next.js com página de cadastro.
- [ ] Criar `services/api` com endpoints de auth/users (Prisma + migrations).
- [ ] Configurar integração B3 (adapter) e job básico de ingestão.
- [ ] Configurar deploy no Vercel (frontend) e Fly.io (backend).

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

