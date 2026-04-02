"use client";

import Link from "next/link";
import { Button, Card, Chip } from "rharuow-ds";

type ContentItem = {
  title: string;
  description: string;
};

type StepItem = {
  label: string;
  text: string;
};

type LandingPageClientProps = {
  walletUrl: string;
  featureCards: ContentItem[];
  proofItems: string[];
  aiFeatures: ContentItem[];
  steps: StepItem[];
  audience: string[];
};

export function LandingPageClient({
  walletUrl,
  featureCards,
  proofItems,
  aiFeatures,
  steps,
  audience,
}: LandingPageClientProps) {
  return (
    <div className="landing-shell grid-glow min-h-screen">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-6 sm:px-6 lg:px-10 lg:py-8">
        <header className="reveal-up flex flex-col gap-6 rounded-[28px] border border-white/10 bg-black/20 px-5 py-5 backdrop-blur md:flex-row md:items-center md:justify-between md:px-7">
          <div>
            <p className="headline text-2xl font-bold tracking-tight text-white">RharouWallet</p>
            <p className="mt-1 text-sm text-slate-300">
              Clareza financeira para quem leva patrimônio a sério.
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <a href="#produto" className="transition-colors hover:text-white">
              Produto
            </a>
            <a href="#como-funciona" className="transition-colors hover:text-white">
              Como funciona
            </a>
            <a href="#para-quem" className="transition-colors hover:text-white">
              Para quem
            </a>
            <Link href={`${walletUrl}/login`}>
              <Button variant="outline">Entrar</Button>
            </Link>
          </nav>
        </header>

        <section className="hero-card reveal-up reveal-up-delay-1 relative overflow-hidden rounded-[34px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
          <div className="absolute -right-12 top-8 h-32 w-32 rounded-full bg-[var(--secondary)]/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-[var(--primary)]/20 blur-3xl" />

          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="eyebrow">Site institucional</p>
              <h1 className="headline mt-4 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                O painel financeiro que troca adivinhação por clareza.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                O RharouWallet organiza patrimônio, custos e entradas em uma única experiência.
                Você para de caçar números soltos e começa a enxergar contexto para decidir melhor.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href={`${walletUrl}/register`}>
                  <Button className="w-full bg-[var(--primary)] text-slate-950 hover:bg-[var(--primary-hover)] sm:w-auto">
                    Criar conta gratuita
                  </Button>
                </Link>
                <Link href="/premium">
                  <Button variant="outline" className="w-full border-white/20 sm:w-auto">
                    Ver proposta premium
                  </Button>
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                <Chip label="Investimentos" active />
                <Chip label="Custos domésticos" active />
                <Chip label="Entradas" active />
                <Chip label="Compartilhamento" active />
              </div>
            </div>

            <div className="grid gap-4">
              <Card className="stat-card rounded-[28px] text-white shadow-none">
                <Card.Body className="space-y-5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-300">Visão consolidada</p>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      Em tempo real
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="headline text-3xl font-bold">360°</p>
                      <p className="mt-1 text-sm text-slate-300">carteira, gastos e renda num só lugar</p>
                    </div>
                    <div>
                      <p className="headline text-3xl font-bold">1 painel</p>
                      <p className="mt-1 text-sm text-slate-300">para responder onde você está e para onde vai</p>
                    </div>
                  </div>
                </Card.Body>
              </Card>

              <Card className="stat-card rounded-[28px] shadow-none">
                <Card.Body className="space-y-3 p-5 text-slate-200">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Resultado</p>
                  <p className="headline text-2xl font-semibold text-white">
                    Menos planilha. Mais leitura estratégica da sua vida financeira.
                  </p>
                </Card.Body>
              </Card>
            </div>
          </div>
        </section>

        <section className="reveal-up reveal-up-delay-2 grid gap-4 md:grid-cols-3">
          {featureCards.map((feature) => (
            <Card key={feature.title} className="section-card rounded-[28px] shadow-none">
              <Card.Body className="space-y-3 p-5">
                <p className="headline text-xl font-semibold text-white">{feature.title}</p>
                <p className="text-sm leading-7 text-slate-300">{feature.description}</p>
              </Card.Body>
            </Card>
          ))}
        </section>

        <section id="produto" className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="section-card reveal-up rounded-[32px] shadow-none">
            <Card.Body className="space-y-5 p-6 lg:p-7">
              <div>
                <p className="eyebrow">O que o produto entrega</p>
                <h2 className="headline mt-3 text-3xl font-bold text-white">
                  Uma narrativa única para seu dinheiro.
                </h2>
              </div>
              <p className="text-base leading-8 text-slate-300">
                O objetivo do RharouWallet não é só registrar números. Ele conecta movimentações,
                ativos e hábitos para que você consiga interpretar o seu momento com menos atrito.
              </p>
              <div className="space-y-3">
                {proofItems.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
                    <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
                    <p className="text-sm leading-6 text-slate-200">{item}</p>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>

          <Card className="section-card reveal-up reveal-up-delay-1 rounded-[32px] shadow-none">
            <Card.Body className="grid gap-4 p-6 lg:grid-cols-2 lg:p-7">
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
                <p className="text-sm text-slate-400">Saúde financeira</p>
                <p className="headline mt-3 text-3xl font-bold text-white">Em evolução</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Indicadores que transformam comportamento financeiro em leitura prática.
                </p>
              </div>
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
                <p className="text-sm text-slate-400">Compartilhamento premium</p>
                <p className="headline mt-3 text-3xl font-bold text-white">Carteira colaborativa</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Convide outra pessoa para acompanhar ou operar com permissões definidas.
                </p>
              </div>
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] p-5 lg:col-span-2">
                <p className="text-sm text-slate-400">Assistente inteligente</p>
                <p className="headline mt-3 text-3xl font-bold text-white">Pergunte sobre a sua realidade</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Em vez de respostas genéricas, o usuário recebe orientação baseada no que já está dentro da sua carteira.
                </p>
              </div>
            </Card.Body>
          </Card>
        </section>

        <section id="como-funciona" className="grid gap-4 lg:grid-cols-3">
          {steps.map((step, index) => (
            <Card
              key={step.label}
              className={`section-card reveal-up rounded-[28px] shadow-none reveal-up-delay-${index + 1}`}
            >
              <Card.Body className="space-y-4 p-5">
                <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-slate-300 uppercase">
                  {step.label}
                </span>
                <p className="headline text-2xl font-semibold text-white">{step.text}</p>
              </Card.Body>
            </Card>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
          <Card className="hero-card rounded-[32px] shadow-none">
            <Card.Body className="flex h-full flex-col gap-5 p-6 lg:p-7">
              <div>
                <p className="eyebrow">IA premium</p>
                <h2 className="headline mt-3 text-3xl font-bold text-white">
                  Uma assistente financeira que olha para os seus próprios dados.
                </h2>
                <p className="mt-4 text-base leading-8 text-slate-300">
                  A inteligência artificial do RharouWallet não entrega respostas genéricas. Ela usa
                  a sua carteira, seus custos e suas entradas para acelerar interpretação e apoiar decisões.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-[22px] border border-emerald-400/18 bg-emerald-400/8 px-4 py-4">
                  <p className="text-sm font-semibold text-emerald-200">Leitura contextual</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Entenda o que está acontecendo sem montar análise manual a cada consulta.
                  </p>
                </div>
                <div className="rounded-[22px] border border-sky-400/18 bg-sky-400/8 px-4 py-4">
                  <p className="text-sm font-semibold text-sky-200">Acesso premium</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Recurso pensado para quem quer transformar dado financeiro em ação mais rápido.
                  </p>
                </div>
              </div>
            </Card.Body>
          </Card>

          <div className="grid gap-4">
            {aiFeatures.map((feature) => (
              <Card key={feature.title} className="section-card rounded-[28px] shadow-none">
                <Card.Body className="space-y-3 p-5">
                  <p className="headline text-xl font-semibold text-white">{feature.title}</p>
                  <p className="text-sm leading-7 text-slate-300">{feature.description}</p>
                </Card.Body>
              </Card>
            ))}
          </div>
        </section>

        <section id="para-quem" className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <Card className="section-card rounded-[32px] shadow-none">
            <Card.Body className="space-y-5 p-6 lg:p-7">
              <div>
                <p className="eyebrow">Para quem</p>
                <h2 className="headline mt-3 text-3xl font-bold text-white">
                  Feito para quem quer governar o próprio dinheiro com menos fricção.
                </h2>
              </div>
              <div className="space-y-3">
                {audience.map((item) => (
                  <div key={item} className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
                    <p className="text-sm leading-7 text-slate-200">{item}</p>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>

          <Card className="hero-card rounded-[32px] shadow-none">
            <Card.Body className="flex h-full flex-col justify-between gap-6 p-6 lg:p-7">
              <div>
                <p className="eyebrow">Convite</p>
                <h2 className="headline mt-3 text-3xl font-bold text-white">
                  Comece com uma conta gratuita e evolua conforme sua rotina financeira amadurece.
                </h2>
                <p className="mt-4 text-base leading-8 text-slate-300">
                  Entre no RharouWallet para organizar patrimônio, acompanhar indicadores e liberar
                  recursos premium como IA contextual e compartilhamento de carteira.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href={`${walletUrl}/register`}>
                  <Button className="w-full bg-[var(--accent)] text-slate-950 hover:bg-[#e7bb58] sm:w-auto">
                    Começar agora
                  </Button>
                </Link>
                <Link href={`${walletUrl}/login`}>
                  <Button variant="outline" className="w-full border-white/20 hover:bg-white/5 sm:w-auto">
                    Já tenho conta
                  </Button>
                </Link>
              </div>
            </Card.Body>
          </Card>
        </section>
      </main>
    </div>
  );
}