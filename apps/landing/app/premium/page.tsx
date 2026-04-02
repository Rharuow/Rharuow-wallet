import { PremiumPageClient } from "./PremiumPageClient";

const premiumFeatures = [
  "Insights financeiros gerados por IA com base nos seus dados",
  "Analise ativos com contexto em vez de respostas genéricas",
  "Diagnóstico de saúde financeira com indicadores objetivos",
  "Sugestões inteligentes para metas e categorização de custos",
  "Compartilhamento de carteira com mais poder de colaboração",
  "Gráficos, análises e leitura aprofundada da sua evolução",
];

const plans = [
  {
    id: "monthly",
    label: "Mensal",
    price: "R$ 12,90",
    period: "/mês",
    description: "Entrada simples para desbloquear IA, análises avançadas e colaboração premium.",
  },
  {
    id: "yearly",
    label: "Anual",
    price: "R$ 119,99",
    period: "/ano",
    monthlyEquivalent: "≈ R$ 10,00/mês",
    badge: "Mais popular",
    description: "Melhor custo-benefício para quem quer manter leitura financeira contínua ao longo do ano.",
  },
];

const comparisons = [
  {
    title: "IA contextual",
    free: "Nao incluso",
    premium: "Respostas e insights com base na sua carteira, custos e entradas",
  },
  {
    title: "Analise aprofundada",
    free: "Visao basica",
    premium: "Relatorios, diagnosticos e interpretacao com mais profundidade",
  },
  {
    title: "Compartilhamento",
    free: "Acesso limitado para convidados",
    premium: "Convidados premium podem colaborar com acesso total",
  },
  {
    title: "Produtividade financeira",
    free: "Controle essencial",
    premium: "Mais automacao, recomendacoes e leitura rapida para agir",
  },
];

export default function PremiumPage() {
  const walletUrl = process.env.WALLET_URL ?? "https://rharuow-wallet-web.vercel.app/dashboard";

  return (
    <PremiumPageClient
      walletUrl={walletUrl}
      premiumFeatures={premiumFeatures}
      plans={plans}
      comparisons={comparisons}
    />
  );
}