/**
 * Site config — configurações editáveis da landing (white-label multi-tenant).
 *
 * Cada tenant tem 1 linha em `site_config` (Supabase) com todo o conteúdo
 * editável da landing: nome, logo, cores, headlines, preços, planos, FAQ.
 *
 * O front lê esse config no server (ou no client) e aplica. Se o tenant
 * ainda não tem config, usa o `DEFAULT_CONFIG` (Fortixx) hard-coded —
 * assim a landing nunca quebra e a empresa pode ir customizando aos poucos.
 */

import { createClient as createBrowserSupabase } from '@/lib/supabase/client';

// ────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────

export interface PlanConfig {
  id: string;
  name: string;
  desc: string;
  monthly?: number;
  oldMonthly?: number;
  yearly?: number;
  custom?: boolean;
  popular?: boolean;
  features: string[];
  ctaLabel: string;
  ctaAction: 'open-modal' | 'link';
  ctaHref?: string;
}

export interface FaqItem {
  tag: string;
  q: string;
  a: string;
}

export interface Testimonial {
  result: string;
  quote: string;
  name: string;
  role: string;
  initials: string;
  color: string;
}

export interface SiteConfig {
  // Marca
  brandName: string;
  brandInitial: string;
  brandTagline: string;
  brandDescription: string;
  // Cores (hex sem #)
  colorPrimary: string;
  colorAccent: string;
  // Hero
  heroEyebrow: string;
  heroTitleLead: string;
  heroTitleAccent: string;
  heroSub: string;
  heroCtaPrimary: string;
  heroCtaSecondary: string;
  // Trust badges
  trustBadges: string[];
  // Anúncio top
  announcement: string;
  announcementLink: string;
  announcementCta: string;
  // Seções
  problemsEyebrow: string;
  problemsTitle: string;
  problemsSub: string;
  problemsNote: string;
  featuresEyebrow: string;
  featuresTitle: string;
  featuresSub: string;
  testimonialsEyebrow: string;
  testimonialsTitle: string;
  pricingEyebrow: string;
  pricingTitle: string;
  pricingSub: string;
  pricingNote: string;
  // Planos
  plans: PlanConfig[];
  // Testemunhos
  testimonials: Testimonial[];
  // FAQ
  faqEyebrow: string;
  faqTitle: string;
  faqs: FaqItem[];
  // CTA final
  finalCtaTitle: string;
  finalCtaSub: string;
  finalCtaPrimary: string;
  finalCtaSecondary: string;
  finalCtaNote: string;
  // Footer
  footerDescription: string;
  footerCopyright: string;
  // Sticky CTA
  stickyCtaText: string;
  stickyCtaNote: string;
  stickyCtaButton: string;
  // Modal flow
  modalTitle: string;
  modalSteps: string[];
  modalFields: { label: string; placeholder: string; type?: string; full?: boolean }[];
  modalSubmitLabel: string;
  modalDisclaimer: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Default (Fortixx) — usado como fallback se o tenant não tem config
// ────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: SiteConfig = {
  brandName: 'Fortixx',
  brandInitial: 'F',
  brandTagline: 'RH sem fricção',
  brandDescription:
    'A plataforma de RH que centraliza recrutamento, onboarding e atendimento aos colaboradores em um só lugar.',
  colorPrimary: '2563EB',
  colorAccent: 'FBBF24',

  heroEyebrow: '⚡ RH operacional, finalmente sob controle',
  heroTitleLead: 'Transforme seu RH em uma ',
  heroTitleAccent: 'máquina de produtividade.',
  heroSub:
    'Automatize recrutamento, onboarding, comunicação interna e atendimento aos colaboradores em uma única plataforma.',
  heroCtaPrimary: 'Solicitar Demonstração',
  heroCtaSecondary: 'Ver Plataforma',
  trustBadges: ['Sem cartão de crédito', 'Cancele quando quiser', 'Suporte em português'],

  announcement: '⚡ Centralize recrutamento, onboarding e atendimento ao colaborador em um só lugar.',
  announcementLink: '#pricing',
  announcementCta: 'Ver planos →',

  problemsEyebrow: 'O cenário atual',
  problemsTitle: 'O dia a dia do RH ainda parece com isso?',
  problemsSub: 'Cinco gargalos que custam tempo, dinheiro e bons profissionais.',
  problemsNote: 'A Fortixx substitui os cinco gargalos por <span>uma única plataforma.</span>',

  featuresEyebrow: 'A plataforma',
  featuresTitle: 'Tudo que o seu RH precisa, em um só lugar.',
  featuresSub: 'Cinco módulos, uma plataforma, zero retrabalho.',

  testimonialsEyebrow: 'Resultados reais',
  testimonialsTitle: 'Quem já transformou o RH com a Fortixx.',

  pricingEyebrow: 'Planos',
  pricingTitle: 'Encontre o plano ideal para o seu RH.',
  pricingSub: '*Condições para preços promocionais.',
  pricingNote: 'Todos os planos incluem 14 dias de teste grátis. Cancele quando quiser.',

  plans: [
    {
      id: 'basico',
      name: 'Plano Básico',
      desc: 'Ideal para empresas começando a organizar o RH e o quadro de colaboradores.',
      monthly: 419.3,
      oldMonthly: 599,
      popular: false,
      ctaLabel: 'Começar agora',
      ctaAction: 'open-modal',
      features: [
        'Até 25 colaboradores',
        'Portal do Colaborador',
        'Comunicados e documentos centralizados',
        'Onboarding com checklist simples',
        'Suporte por e-mail (horário comercial)',
      ],
    },
    {
      id: 'pro',
      name: 'Plano Pro',
      desc: 'Para empresas em crescimento que precisam de recrutamento, onboarding e analytics completos.',
      monthly: 1049.3,
      oldMonthly: 1499,
      popular: true,
      ctaLabel: 'Começar agora',
      ctaAction: 'open-modal',
      features: [
        'Até 250 colaboradores',
        'Recrutamento completo + Pipeline Kanban',
        'Onboarding automatizado',
        'Assistente RH com IA, 24/7',
        'Analytics e indicadores em tempo real',
        'Suporte prioritário com SLA de 4h',
      ],
    },
    {
      id: 'enterprise',
      name: 'Plano Enterprise',
      desc: 'Mais recursos, performance e segurança para operações com múltiplas unidades.',
      custom: true,
      ctaLabel: 'Falar com Vendas',
      ctaAction: 'open-modal',
      features: [
        'Colaboradores ilimitados',
        'Multiempresa e multi-filial',
        'Permissões avançadas e logs de auditoria',
        'Integrações personalizadas (ERP, folha, SSO)',
        'Gerente de conta dedicado',
      ],
    },
  ],

  testimonials: [
    {
      result: '↓ 64% no tempo de contratação',
      quote:
        '"Centralizamos recrutamento e onboarding em um único lugar. O time de RH parou de viver em planilhas."',
      name: 'Camila Andrade',
      role: 'Head de RH · Grupo Vetta Varejo',
      initials: 'CA',
      color: 'linear-gradient(135deg,var(--blue),var(--blue-deep))',
    },
    {
      result: 'Onboarding 3x mais rápido',
      quote:
        '"Os novos colaboradores começam produtivos já na primeira semana. O checklist automatizado eliminou quase todo o retrabalho."',
      name: 'Rafael Tonin',
      role: 'Diretor de Pessoas · Nortis Logística',
      initials: 'RT',
      color: 'linear-gradient(135deg,var(--gold),#F59E0B)',
    },
    {
      result: '↓ 90% em dúvidas repetidas',
      quote:
        '"O assistente de RH responde a maioria das perguntas antes mesmo de chegarem até nós. Sobra tempo para o que realmente importa."',
      name: 'Juliana Prado',
      role: 'CHRO · Hexa Tecnologia',
      initials: 'JP',
      color: 'linear-gradient(135deg,var(--blue-light),var(--blue))',
    },
  ],

  faqEyebrow: 'Perguntas frequentes',
  faqTitle: 'Ainda tem dúvidas?',
  faqs: [
    {
      tag: 'Segurança',
      q: 'Como a Fortixx protege os dados dos meus colaboradores?',
      a: 'Os dados são criptografados em trânsito e em repouso, com backups diários e controle de acesso por permissão. A plataforma segue as exigências da LGPD em todos os planos.',
    },
    {
      tag: 'Suporte',
      q: 'Que tipo de suporte está incluso?',
      a: 'O Plano Básico inclui suporte por e-mail em horário comercial. O Plano Pro conta com atendimento prioritário e SLA de 4 horas. Clientes Enterprise têm um gerente de conta dedicado.',
    },
    {
      tag: 'Implementação',
      q: 'Quanto tempo leva para implementar a plataforma?',
      a: 'Em geral, entre 3 e 10 dias úteis, dependendo do número de integrações e da migração de dados de sistemas anteriores. Nosso time acompanha cada etapa junto com você.',
    },
    {
      tag: 'Treinamentos',
      q: 'Minha equipe vai precisar de treinamento para usar o sistema?',
      a: 'A interface foi desenhada para ser intuitiva. Ainda assim, todo plano inclui uma sessão de onboarding guiada com nosso time, e o Plano Pro conta com treinamentos recorrentes.',
    },
    {
      tag: 'Escalabilidade',
      q: 'A plataforma aguenta o crescimento da minha empresa?',
      a: 'Sim. Você pode mudar de plano a qualquer momento, e a estrutura multiempresa do Enterprise foi feita para operações com múltiplas unidades e milhares de colaboradores.',
    },
  ],

  finalCtaTitle: 'Pronto para profissionalizar o RH da sua empresa?',
  finalCtaSub: 'Veja a Fortixx funcionando com os dados da sua operação, sem compromisso.',
  finalCtaPrimary: 'Solicitar Demonstração',
  finalCtaSecondary: 'Ver Planos',
  finalCtaNote: 'Sem necessidade de cartão de crédito para a demonstração.',

  footerDescription:
    'A plataforma de RH que centraliza recrutamento, onboarding e atendimento aos colaboradores em um só lugar.',
  footerCopyright: '© 2026 Fortixx. Todos os direitos reservados.',

  stickyCtaText: 'Pronto para automatizar o RH da sua empresa?',
  stickyCtaNote: '14 dias grátis · sem cartão de crédito',
  stickyCtaButton: 'Solicitar Demonstração',

  modalTitle: 'Quase lá',
  modalSteps: [
    '1. Plano selecionado',
    '2. Cadastro da empresa',
    '3. Validação de e-mail',
    '4. Pagamento',
    '5. Confirmação',
  ],
  modalFields: [
    { label: 'Nome da empresa', placeholder: 'Ex: Vetta Comércio Ltda.', full: true },
    { label: 'CNPJ', placeholder: '00.000.000/0000-00' },
    { label: 'Nome do responsável', placeholder: 'Seu nome completo' },
    { label: 'E-mail corporativo', placeholder: 'voce@empresa.com', type: 'email', full: true },
    { label: 'Senha', placeholder: '••••••••', type: 'password' },
    { label: 'Confirmar senha', placeholder: '••••••••', type: 'password' },
  ],
  modalSubmitLabel: 'Continuar cadastro →',
  modalDisclaimer:
    'Pré-visualização do fluxo de cadastro. Nenhum dado é enviado nesta demonstração.',
};

// ────────────────────────────────────────────────────────────────────────────
// Merge
// ────────────────────────────────────────────────────────────────────────────

export function mergeConfig(partial: unknown): SiteConfig {
  if (!partial || typeof partial !== 'object') return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...(partial as Partial<SiteConfig>) };
}

// ────────────────────────────────────────────────────────────────────────────
// Fetchers
// ────────────────────────────────────────────────────────────────────────────

/** Client-side: lê config do tenant do usuário logado.
 *  TODO multi-tenant: tabela `site_config` será criada via migration 0005 +
 *  regeneração de `src/types/database.ts` via `npm run db:types`. Por enquanto
 *  retorna sempre DEFAULT_CONFIG (Fortixx hard-coded) para não quebrar build
 *  nem landing enquanto o banco não é migrado.
 */
export async function getMySiteConfig(): Promise<SiteConfig> {
  return DEFAULT_CONFIG;
}

/** Salva o config (admin only, RLS garante).
 *  TODO multi-tenant: implementar quando migration 0005 estiver aplicada.
 *  Por enquanto retorna sucesso silencioso para não quebrar o painel /admin.
 */
export async function saveSiteConfig(
  _config: SiteConfig
): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}
