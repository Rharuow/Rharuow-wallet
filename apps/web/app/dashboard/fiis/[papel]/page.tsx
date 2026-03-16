import { notFound } from "next/navigation";
import Link from "next/link";
import { getAuthToken } from "@/lib/auth";
import { formatBRL, formatCompact } from "@/lib/format";
import { Metric } from "@/components/Metric";
import { FiiAnalysisCard } from "./FiiAnalysisCard";

export type FiiItem = {
  papel: string;
  segmento: string;
  cotacao: number | null;
  ffoYield: number | null;
  dividendYield: number | null;
  pvp: number | null;
  valorMercado: number | null;
  liquidez: number | null;
  qtdImoveis: number | null;
  precoM2: number | null;
  aluguelM2: number | null;
  capRate: number | null;
  vacanciaMedia: number | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchFiiDetail(papel: string): Promise<FiiItem | null> {
  try {
    const token = await getAuthToken();
    if (!token) return null;
    const res = await fetch(
      `${API_URL}/v1/fiis/${encodeURIComponent(papel.toUpperCase())}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.fii ?? null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------
// Helpers de formatação
// ----------------------------------------------------------------
function pct(v: number | null | undefined, decimals = 2) {
  if (v == null) return "—";
  return `${v.toFixed(decimals)}%`;
}
function num(v: number | null | undefined, decimals = 2) {
  if (v == null) return "—";
  return v.toFixed(decimals);
}
function compact(v: number | null | undefined) {
  if (v == null) return "—";
  return formatCompact(v);
}

// ----------------------------------------------------------------
// Sub-componentes
// ----------------------------------------------------------------
function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background-secondary)] p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}

function MetricGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  );
}

// ----------------------------------------------------------------
// Página
// ----------------------------------------------------------------
type PageProps = { params: Promise<{ papel: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { papel } = await params;
  return { title: `${papel.toUpperCase()} — RharouWallet` };
}

export default async function FiiDetailPage({ params }: PageProps) {
  const { papel } = await params;
  const fii = await fetchFiiDetail(papel);

  if (!fii) notFound();

  const pvpColor =
    fii.pvp == null
      ? "text-slate-500"
      : fii.pvp < 1
      ? "text-green-600"
      : fii.pvp > 1.2
      ? "text-red-600"
      : "text-slate-500";

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 flex items-center gap-1">
        <Link href="/dashboard/fiis" className="hover:text-[var(--primary)]">
          FIIs
        </Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">{fii.papel}</span>
      </nav>

      {/* Header card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background-secondary)] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Avatar + nome */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-lg font-bold text-[var(--primary)]">
              {fii.papel.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-[var(--foreground)]">
                {fii.papel}
              </h1>
              {fii.segmento && (
                <span className="mt-1 inline-flex items-center rounded-full bg-[var(--primary-light)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                  {fii.segmento}
                </span>
              )}
            </div>
          </div>

          {/* Cotação */}
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold text-[var(--foreground)]">
              {fii.cotacao != null ? formatBRL(fii.cotacao) : "—"}
            </div>
            <div className={`text-sm font-semibold mt-1 ${pvpColor}`}>
              P/VP: {num(fii.pvp)}{" "}
              <span className="text-xs font-normal text-slate-400">
                {fii.pvp != null
                  ? fii.pvp < 1
                    ? "(desconto)"
                    : fii.pvp > 1.2
                    ? "(prêmio alto)"
                    : "(próximo ao par)"
                  : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Visão geral rápida */}
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 border-t border-[var(--border)] pt-5">
          <Metric
            label="D.Y."
            value={pct(fii.dividendYield)}
            hint="Dividend Yield: rendimento distribuído nos últimos 12 meses em relação à cotação atual"
            position="right"
          />
          <Metric
            label="FFO Yield"
            value={pct(fii.ffoYield)}
            hint="Funds From Operations Yield: geração de caixa operacional em relação à cotação"
            position="top"
          />
          <Metric
            label="Val. Mercado"
            value={compact(fii.valorMercado)}
            hint="Capitalização total do fundo: preço × total de cotas emitidas"
            position="top"
          />
          <Metric
            label="Liquidez Diária"
            value={compact(fii.liquidez)}
            hint="Volume médio de negociação diária nos últimos 2 meses"
            position="left"
          />
        </div>
      </div>

      {/* Grid de seções */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Rendimento */}
        <SectionCard title="Rendimento">
          <MetricGrid>
            <Metric
              label="Dividend Yield"
              value={pct(fii.dividendYield)}
              hint="Rendimento distribuído nos últimos 12 meses / cotação atual"
              position="right"
            />
            <Metric
              label="FFO Yield"
              value={pct(fii.ffoYield)}
              hint="Funds From Operations / cotação: mede a geração de caixa real do fundo"
              position="top"
            />
          </MetricGrid>
        </SectionCard>

        {/* Valuation */}
        <SectionCard title="Valuation">
          <MetricGrid>
            <Metric
              label="Cotação"
              value={fii.cotacao != null ? formatBRL(fii.cotacao) : "—"}
              hint="Preço atual da cota em bolsa"
              position="right"
            />
            <Metric
              label="P/VP"
              value={num(fii.pvp)}
              hint="Preço / Valor Patrimonial por cota. Abaixo de 1 = desconto sobre o patrimônio do fundo."
              position="top"
            />
            <Metric
              label="Val. Mercado"
              value={compact(fii.valorMercado)}
              hint="Capitalização total do fundo"
              position="top"
            />
            <Metric
              label="Liquidez"
              value={compact(fii.liquidez)}
              hint="Liquidez média diária — quanto é negociado por dia em média"
              position="left"
            />
          </MetricGrid>
        </SectionCard>

        {/* Portfólio Imobiliário */}
        <SectionCard title="Portfólio Imobiliário">
          <MetricGrid>
            <Metric
              label="Qtd. Imóveis"
              value={fii.qtdImoveis != null ? String(fii.qtdImoveis) : "—"}
              hint="Número total de imóveis no portfólio do fundo"
              position="right"
            />
            <Metric
              label="Preço/m²"
              value={fii.precoM2 != null ? formatBRL(fii.precoM2) : "—"}
              hint="Valor médio de aquisição por metro quadrado do portfólio"
              position="top"
            />
            <Metric
              label="Aluguel/m²"
              value={fii.aluguelM2 != null ? formatBRL(fii.aluguelM2) : "—"}
              hint="Receita de aluguel por metro quadrado do portfólio"
              position="top"
            />
            <Metric
              label="Cap Rate"
              value={pct(fii.capRate)}
              hint="Capitalization Rate: relação entre a receita anual de aluguel e o valor dos imóveis"
              position="left"
            />
          </MetricGrid>
        </SectionCard>

        {/* Vacância */}
        <SectionCard title="Vacância e Ocupação">
          <MetricGrid>
            <Metric
              label="Vacância Média"
              value={pct(fii.vacanciaMedia)}
              hint="Percentual médio de área disponível não locada no portfólio"
              position="right"
            />
            <Metric
              label="Ocupação"
              value={
                fii.vacanciaMedia != null
                  ? pct(100 - fii.vacanciaMedia)
                  : "—"
              }
              hint="Taxa de ocupação: 100% − vacância média"
              position="top"
            />
          </MetricGrid>
        </SectionCard>
      </div>

      {/* Análise com IA */}
      <FiiAnalysisCard papel={fii.papel} />
    </div>
  );
}
