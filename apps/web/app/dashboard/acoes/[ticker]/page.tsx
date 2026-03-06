import { notFound } from "next/navigation";
import Link from "next/link";
import { getAuthToken } from "@/lib/auth";
import { formatBRL, formatCompact } from "@/lib/format";
import { Metric } from "@/components/Metric";

type SummaryProfile = {
  sector: string | null;
  industry: string | null;
  website: string | null;
  longBusinessSummary: string | null;
  fullTimeEmployees: number | null;
  cnpj: string | null;
};

type FinancialData = {
  totalRevenue: number | null;
  grossProfits: number | null;
  ebitda: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  freeCashflow: number | null;
  operatingCashflow: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  returnOnAssets: number | null;
  returnOnEquity: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
};

type DefaultKeyStatistics = {
  enterpriseValue: number | null;
  bookValue: number | null;
  priceToBook: number | null;
  sharesOutstanding: number | null;
  netIncomeToCommon: number | null;
  trailingEps: number | null;
  pegRatio: number | null;
  enterpriseToRevenue: number | null;
  enterpriseToEbitda: number | null;
  beta: number | null;
};

type StockDetail = {
  symbol: string;
  shortName: string | null;
  longName: string | null;
  currency: string | null;
  logourl: string | null;
  regularMarketPrice: number | null;
  regularMarketDayHigh: number | null;
  regularMarketDayLow: number | null;
  regularMarketChange: number | null;
  regularMarketChangePercent: number | null;
  regularMarketOpen: number | null;
  regularMarketPreviousClose: number | null;
  regularMarketVolume: number | null;
  marketCap: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  priceEarnings: number | null;
  earningsPerShare: number | null;
  summaryProfile: SummaryProfile | null;
  financialData: FinancialData | null;
  defaultKeyStatistics: DefaultKeyStatistics | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchStockDetail(ticker: string): Promise<StockDetail | null> {
  try {
    const token = await getAuthToken();
    if (!token) return null;
    const res = await fetch(
      `${API_URL}/v1/stocks/${encodeURIComponent(ticker.toUpperCase())}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------
// Helpers de formatação
// ----------------------------------------------------------------
function pct(v: number | null | undefined, decimals = 2) {
  if (v == null) return "—";
  return `${(v * 100).toFixed(decimals)}%`;
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
type PageProps = { params: Promise<{ ticker: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { ticker } = await params;
  return { title: `${ticker.toUpperCase()} — RharouWallet` };
}

export default async function StockDetailPage({ params }: PageProps) {
  const { ticker } = await params;
  const stock = await fetchStockDetail(ticker);

  if (!stock) notFound();

  const changePercent = stock.regularMarketChangePercent ?? 0;
  const changeColor =
    changePercent > 0
      ? "text-green-600"
      : changePercent < 0
      ? "text-red-600"
      : "text-slate-500";

  const fd = stock.financialData;
  const ks = stock.defaultKeyStatistics;
  const sp = stock.summaryProfile;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 flex items-center gap-1">
        <Link href="/dashboard/acoes" className="hover:text-[var(--primary)]">
          Ações
        </Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">{stock.symbol}</span>
      </nav>

      {/* Header card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background-secondary)] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Logo + nome */}
          <div className="flex items-center gap-4 min-w-0">
            {stock.logourl ? (
              <img
                src={stock.logourl}
                alt={stock.symbol}
                className="h-14 w-14 rounded-full object-contain bg-white shrink-0 p-1 border border-[var(--border)]"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-lg font-bold text-[var(--primary)]">
                {stock.symbol.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-[var(--foreground)]">
                {stock.symbol}
              </h1>
              <p className="text-sm text-slate-400 truncate">
                {stock.longName ?? stock.shortName ?? "—"}
              </p>
              {sp?.sector && (
                <span className="mt-1 inline-flex items-center rounded-full bg-[var(--primary-light)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                  {sp.sector}
                  {sp.industry ? ` · ${sp.industry}` : ""}
                </span>
              )}
            </div>
          </div>

          {/* Cotação */}
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold text-[var(--foreground)]">
              {stock.regularMarketPrice != null
                ? formatBRL(stock.regularMarketPrice)
                : "—"}
            </div>
            <div className={`text-sm font-semibold ${changeColor}`}>
              {changePercent >= 0 ? "+" : ""}
              {changePercent.toFixed(2)}%{" "}
              <span className="text-xs font-normal text-slate-400">hoje</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Mín {stock.regularMarketDayLow != null ? formatBRL(stock.regularMarketDayLow) : "—"}{" "}
              · Máx {stock.regularMarketDayHigh != null ? formatBRL(stock.regularMarketDayHigh) : "—"}
            </div>
          </div>
        </div>

        {/* Visão geral rápida */}
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 border-t border-[var(--border)] pt-5">
          <Metric
            label="Market Cap"
            value={compact(stock.marketCap)}
            hint="Valor de mercado total: preço × total de ações em circulação"
            position="right"
          />
          <Metric
            label="P/L"
            value={num(stock.priceEarnings)}
            hint="Preço/Lucro: quantas vezes o lucro o mercado está pagando pela ação"
            position="top"
          />
          <Metric
            label="LPA"
            value={stock.earningsPerShare != null ? formatBRL(stock.earningsPerShare) : "—"}
            hint="Lucro Por Ação (EPS): lucro líquido dividido pelo total de ações"
            position="top"
          />
          <Metric
            label="Volume"
            value={compact(stock.regularMarketVolume)}
            hint="Volume financeiro negociado no dia"
            position="left"
          />
          <Metric
            label="Abertura"
            value={stock.regularMarketOpen != null ? formatBRL(stock.regularMarketOpen) : "—"}
            hint="Preço de abertura do pregão atual"
            position="right"
          />
          <Metric
            label="Fech. Ant."
            value={stock.regularMarketPreviousClose != null ? formatBRL(stock.regularMarketPreviousClose) : "—"}
            hint="Preço de fechamento do pregão anterior"
            position="top"
          />
          <Metric
            label="Mín 52 sem."
            value={stock.fiftyTwoWeekLow != null ? formatBRL(stock.fiftyTwoWeekLow) : "—"}
            hint="Menor cotação das últimas 52 semanas"
            position="top"
          />
          <Metric
            label="Máx 52 sem."
            value={stock.fiftyTwoWeekHigh != null ? formatBRL(stock.fiftyTwoWeekHigh) : "—"}
            hint="Maior cotação das últimas 52 semanas"
            position="left"
          />
        </div>
      </div>

      {/* Grid de seções */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Valuation */}
        <SectionCard title="Valuation">
          <MetricGrid>
            <Metric
              label="P/VP"
              value={num(ks?.priceToBook)}
              hint="Preço / Valor Patrimonial por ação"
              position="right"
            />
            <Metric
              label="P/L (trailing)"
              value={num(stock.priceEarnings)}
              hint="Preço / Lucro dos últimos 12 meses"
              position="top"
            />
            <Metric
              label="PEG Ratio"
              value={num(ks?.pegRatio)}
              hint="P/L ajustado pelo crescimento esperado do lucro"
              position="top"
            />
            <Metric
              label="EV"
              value={compact(ks?.enterpriseValue)}
              hint="Enterprise Value: valor de mercado + dívida líquida"
              position="left"
            />
            <Metric
              label="EV/Receita"
              value={num(ks?.enterpriseToRevenue)}
              hint="Enterprise Value dividido pela receita líquida"
              position="right"
            />
            <Metric
              label="EV/EBITDA"
              value={num(ks?.enterpriseToEbitda)}
              hint="Enterprise Value dividido pelo EBITDA"
              position="top"
            />
            <Metric
              label="Valor Patr."
              value={ks?.bookValue != null ? formatBRL(ks.bookValue) : "—"}
              hint="Patrimônio líquido por ação (book value)"
              position="top"
            />
            <Metric
              label="Beta"
              value={num(ks?.beta)}
              hint="Beta: volatilidade da ação em relação ao índice de referência. Acima de 1 = mais volátil."
              position="left"
            />
          </MetricGrid>
        </SectionCard>

        {/* Resultados */}
        <SectionCard title="Resultados">
          <MetricGrid>
            <Metric
              label="Receita"
              value={compact(fd?.totalRevenue)}
              hint="Receita líquida total (últimos 12 meses)"
              position="right"
            />
            <Metric
              label="Lucro Bruto"
              value={compact(fd?.grossProfits)}
              hint="Receita menos custo dos produtos/serviços vendidos"
              position="top"
            />
            <Metric
              label="EBITDA"
              value={compact(fd?.ebitda)}
              hint="Lucro antes de juros, impostos, depreciação e amortização"
              position="top"
            />
            <Metric
              label="Lucro Líq."
              value={compact(ks?.netIncomeToCommon)}
              hint="Lucro líquido atribuível aos acionistas ordinários"
              position="left"
            />
            <Metric
              label="FCL"
              value={compact(fd?.freeCashflow)}
              hint="Free Cash Flow: caixa gerado após investimentos em capital (CAPEX)"
              position="right"
            />
            <Metric
              label="FC Operac."
              value={compact(fd?.operatingCashflow)}
              hint="Fluxo de caixa gerado pelas operações"
              position="top"
            />
            <Metric
              label="LPA"
              value={ks?.trailingEps != null ? formatBRL(ks.trailingEps) : "—"}
              hint="Lucro Por Ação nos últimos 12 meses"
              position="top"
            />
            <Metric
              label="Cresc. Receita"
              value={pct(fd?.revenueGrowth)}
              hint="Crescimento da receita no último trimestre vs. mesmo período do ano anterior"
              position="left"
            />
          </MetricGrid>
        </SectionCard>

        {/* Margens e Retornos */}
        <SectionCard title="Margens e Retornos">
          <MetricGrid>
            <Metric
              label="Mrg. Bruta"
              value={pct(fd?.grossMargins)}
              hint="Margem bruta: lucro bruto / receita"
              position="right"
            />
            <Metric
              label="Mrg. EBIT"
              value={pct(fd?.operatingMargins)}
              hint="Margem operacional: lucro operacional / receita"
              position="top"
            />
            <Metric
              label="Mrg. Líq."
              value={pct(fd?.profitMargins)}
              hint="Margem líquida: lucro líquido / receita"
              position="top"
            />
            <Metric
              label="ROE"
              value={pct(fd?.returnOnEquity)}
              hint="Return on Equity: lucro líquido / patrimônio líquido médio"
              position="left"
            />
            <Metric
              label="ROA"
              value={pct(fd?.returnOnAssets)}
              hint="Return on Assets: lucro líquido / ativo total médio"
              position="right"
            />
            <Metric
              label="Cresc. Lucro"
              value={pct(fd?.earningsGrowth)}
              hint="Crescimento do lucro no último trimestre vs. mesmo período do ano anterior"
              position="top"
            />
          </MetricGrid>
        </SectionCard>

        {/* Endividamento e Liquidez */}
        <SectionCard title="Endividamento e Liquidez">
          <MetricGrid>
            <Metric
              label="Dív. Total"
              value={compact(fd?.totalDebt)}
              hint="Dívida bruta total (curto + longo prazo)"
              position="right"
            />
            <Metric
              label="Caixa"
              value={compact(fd?.totalCash)}
              hint="Caixa e equivalentes de caixa"
              position="top"
            />
            <Metric
              label="Dív./PL"
              value={num(fd?.debtToEquity)}
              hint="Dívida bruta dividida pelo patrimônio líquido"
              position="top"
            />
            <Metric
              label="Liq. Corrente"
              value={num(fd?.currentRatio)}
              hint="Ativo circulante / passivo circulante. Acima de 1 indica boa saúde de curto prazo."
              position="left"
            />
            <Metric
              label="Liq. Seca"
              value={num(fd?.quickRatio)}
              hint="(Ativo circulante − estoque) / passivo circulante"
              position="right"
            />
            <Metric
              label="Ações em circ."
              value={compact(ks?.sharesOutstanding)}
              hint="Total de ações em circulação no mercado"
              position="top"
            />
          </MetricGrid>
        </SectionCard>
      </div>

      {/* Sobre a empresa */}
      {sp && (
        <SectionCard title="Sobre a Empresa">
          <div className="flex flex-col gap-4">
            {/* Info rápida */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              {sp.website && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Site
                  </span>
                  <a
                    href={sp.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--primary)] hover:underline truncate block"
                  >
                    {sp.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
              {sp.fullTimeEmployees != null && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    Funcionários
                  </span>
                  <span className="text-[var(--foreground)]">
                    {sp.fullTimeEmployees.toLocaleString("pt-BR")}
                  </span>
                </div>
              )}
              {sp.cnpj && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                    CNPJ
                  </span>
                  <span className="text-[var(--foreground)]">{sp.cnpj}</span>
                </div>
              )}
            </div>

            {/* Resumo do negócio */}
            {sp.longBusinessSummary && (
              <p className="text-sm text-slate-500 leading-relaxed">
                {sp.longBusinessSummary}
              </p>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
