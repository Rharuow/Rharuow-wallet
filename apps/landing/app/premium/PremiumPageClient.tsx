"use client";

import Link from "next/link";
import { Button, Card, Chip } from "rharuow-ds";

type Plan = {
  id: string;
  label: string;
  price: string;
  period: string;
  description: string;
  monthlyEquivalent?: string;
  badge?: string;
};

type Comparison = {
  title: string;
  free: string;
  premium: string;
};

type PremiumPageClientProps = {
  walletUrl: string;
  premiumFeatures: string[];
  plans: Plan[];
  comparisons: Comparison[];
};

export function PremiumPageClient({
  walletUrl,
  premiumFeatures,
  plans,
  comparisons,
}: PremiumPageClientProps) {
  return (
    <div className="landing-shell grid-glow min-h-screen">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-6 lg:px-10 lg:py-8">
        <header className="reveal-up flex flex-col gap-4 rounded-[28px] border border-white/10 bg-black/20 px-5 py-5 backdrop-blur md:flex-row md:items-center md:justify-between md:px-7">
          <div>
            <Link href="/" className="headline text-2xl font-bold tracking-tight text-white">
              RharouWallet
            </Link>
            <p className="mt-1 text-sm text-slate-300">
              Planos premium para transformar controle financeiro em leitura estrategica.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/">
              <Button variant="outline">Voltar para a home</Button>
            </Link>
            <Link href={`${walletUrl}/register`}>
              <Button className="bg-[var(--primary)] text-slate-950 hover:bg-[var(--primary-hover)]">
                Criar conta
              </Button>
            </Link>
          </div>
        </header>

        <section className="hero-card reveal-up reveal-up-delay-1 rounded-[34px] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="eyebrow">Premium</p>
              <h1 className="headline mt-4 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                Desbloqueie a camada mais poderosa do RharouWallet.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                O plano premium amplia a leitura da sua vida financeira com IA, analises avancadas
                e recursos de colaboracao para quem quer decidir melhor com menos atrito.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                <Chip label="IA contextual" active />
                <Chip label="Saude financeira" active />
                <Chip label="Analise avancada" active />
                <Chip label="Compartilhamento" active />
              </div>
            </div>

            <Card className="stat-card rounded-[30px] shadow-none">
              <Card.Body className="space-y-5 p-6 text-white">
                <div className="flex items-center justify-between gap-3">
                  <p className="headline text-2xl font-semibold">A partir de R$ 12,90/mês</p>
                  <Chip label="Premium" active />
                </div>
                <p className="text-sm leading-7 text-slate-300">
                  Assine para destravar os recursos que mais reduzem tempo de analise e aumentam a clareza da sua rotina financeira.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link href={`${walletUrl}/register`}>
                    <Button className="w-full bg-[var(--accent)] text-slate-950 hover:bg-[#e7bb58]">
                      Comecar agora
                    </Button>
                  </Link>
                  <Link href={`${walletUrl}/login`}>
                    <Button variant="outline" className="w-full border-white/20 hover:bg-white/5">
                      Ja tenho conta
                    </Button>
                  </Link>
                </div>
              </Card.Body>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {premiumFeatures.map((feature, index) => (
            <Card key={feature} className="section-card rounded-[28px] shadow-none">
              <Card.Body className="space-y-3 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Beneficio {index + 1}
                </p>
                <p className="headline text-2xl font-semibold text-white">{feature}</p>
              </Card.Body>
            </Card>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="hero-card rounded-[32px] shadow-none">
            <Card.Body className="space-y-5 p-6 lg:p-7">
              <div>
                <p className="eyebrow">Por que premium</p>
                <h2 className="headline mt-3 text-3xl font-bold text-white">
                  Menos trabalho manual. Mais criterio para investir, gastar e ajustar rota.
                </h2>
              </div>
              <p className="text-base leading-8 text-slate-300">
                O premium foi pensado para usuarios que nao querem apenas registrar movimentacoes,
                mas interpretar comportamento financeiro, comparar cenario e agir mais rapido.
              </p>
              <div className="space-y-3">
                <div className="rounded-[22px] border border-emerald-400/18 bg-emerald-400/8 px-4 py-4">
                  <p className="text-sm font-semibold text-emerald-200">IA para perguntas reais</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Consulte custos, ativos e evolucao patrimonial sem depender de leitura manual item a item.
                  </p>
                </div>
                <div className="rounded-[22px] border border-sky-400/18 bg-sky-400/8 px-4 py-4">
                  <p className="text-sm font-semibold text-sky-200">Mais poder de colaboracao</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Compartilhe carteira com regras mais fortes para tornar a gestao conjunta mais util.
                  </p>
                </div>
              </div>
            </Card.Body>
          </Card>

          <Card className="section-card rounded-[32px] shadow-none">
            <Card.Body className="space-y-4 p-6 lg:p-7">
              <div>
                <p className="eyebrow">Comparativo</p>
                <h2 className="headline mt-3 text-3xl font-bold text-white">
                  O que muda ao fazer upgrade.
                </h2>
              </div>

              <div className="space-y-3">
                {comparisons.map((item) => (
                  <div key={item.title} className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <p className="headline text-xl font-semibold text-white">{item.title}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-black/15 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Free</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{item.free}</p>
                      </div>
                      <div className="rounded-2xl border border-[var(--primary)]/25 bg-[var(--primary)]/8 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Premium</p>
                        <p className="mt-2 text-sm leading-6 text-slate-100">{item.premium}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {plans.map((plan) => (
            <Card key={plan.id} className="section-card relative rounded-[32px] shadow-none">
              <Card.Body className="space-y-5 p-6 lg:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-400">{plan.label}</p>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="headline text-4xl font-bold text-white">{plan.price}</span>
                      <span className="pb-1 text-sm text-slate-400">{plan.period}</span>
                    </div>
                    {plan.monthlyEquivalent ? (
                      <p className="mt-2 text-sm text-emerald-200">{plan.monthlyEquivalent}</p>
                    ) : null}
                  </div>
                  {plan.badge ? <Chip label={plan.badge} active /> : null}
                </div>

                <p className="text-sm leading-7 text-slate-300">{plan.description}</p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href={`${walletUrl}/register`}>
                    <Button className="w-full bg-[var(--primary)] text-slate-950 hover:bg-[var(--primary-hover)] sm:w-auto">
                      Criar conta e assinar
                    </Button>
                  </Link>
                  <Link href={`${walletUrl}/login`}>
                    <Button variant="outline" className="w-full border-white/20 hover:bg-white/5 sm:w-auto">
                      Entrar para assinar
                    </Button>
                  </Link>
                </div>
              </Card.Body>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}