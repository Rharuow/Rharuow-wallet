import { LandingPageClient } from "./LandingPageClient";

const featureCards = [
  {
    title: "Patrimônio e investimentos em um único painel",
    description:
      "Acompanhe ações, FIIs, entradas e custos sem depender de planilha improvisada ou cinco abas abertas ao mesmo tempo.",
  },
  {
    title: "Diagnóstico financeiro acionável",
    description:
      "Transforme movimentações soltas em clareza: veja tendências, gargalos de gastos e oportunidades de ajuste.",
  },
  {
    title: "Assistente que responde com base na sua carteira",
    description:
      "A IA interpreta os seus dados para responder dúvidas, gerar leituras rápidas e destacar oportunidades com mais contexto.",
  },
];

const proofItems = [
  "Visão consolidada de entradas, custos e investimentos",
  "Fluxo premium com compartilhamento de carteira",
  "IA aplicada à sua rotina financeira com respostas contextualizadas",
  "Experiência mobile-first para acompanhar tudo no dia a dia",
  "Leitura mais rápida para decidir sem depender de planilhas frágeis",
];

const aiFeatures = [
  {
    title: "Perguntas sobre sua própria carteira",
    description:
      "O usuário premium pode consultar a IA sobre custos, entradas, evolução patrimonial e ativos com respostas baseadas no seu contexto real.",
  },
  {
    title: "Insights que poupam tempo de análise",
    description:
      "Em vez de interpretar cada número isoladamente, a IA resume sinais importantes e ajuda a identificar padrões com mais rapidez.",
  },
  {
    title: "Camada premium de apoio à decisão",
    description:
      "No plano premium, a IA vira uma ferramenta prática para revisar carteira, entender gargalos e agir com mais segurança.",
  },
];

const steps = [
  {
    label: "1. Conecte sua rotina",
    text: "Cadastre movimentações, acompanhe sua carteira e centralize o que hoje está espalhado.",
  },
  {
    label: "2. Enxergue os padrões",
    text: "Painéis e análises mostram o que está ajudando seu patrimônio a crescer e o que está drenando caixa.",
  },
  {
    label: "3. Tome decisão com contexto",
    text: "Use os insights do produto para agir com menos ruído e mais critério.",
  },
];

const audience = [
  "Investidores pessoa física que querem consolidar a visão de patrimônio",
  "Casais e famílias que precisam compartilhar leitura financeira com segurança",
  "Usuários que saíram da planilha, mas ainda não encontraram um painel claro",
];

export default function LandingPage() {
  const walletUrl = process.env.WALLET_URL ?? "https://rharuow-wallet-web.vercel.app/dashboard";

  return (
    <LandingPageClient
      walletUrl={walletUrl}
      featureCards={featureCards}
      proofItems={proofItems}
      aiFeatures={aiFeatures}
      steps={steps}
      audience={audience}
    />
  );
}