# Fortixx — SaaS de RH

Multi-tenant, com autenticação real, banco de dados isolado por empresa,
cobrança recorrente via Stripe, e-mail transacional via Resend, e automação
de parsing de currículo via n8n.

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end + Back-end | Next.js 14 (App Router), TypeScript |
| Banco de dados | Supabase (PostgreSQL + Row Level Security) |
| Autenticação | Supabase Auth (e-mail/senha + 2FA/TOTP real) |
| Pagamentos | Stripe (Checkout + assinaturas recorrentes) |
| E-mail transacional | Resend |
| Automação | n8n (parsing de currículo) |
| Deploy | Vercel |
| CI | GitHub Actions |

## Como rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha com suas chaves — ver DEPLOY_CHECKLIST.md
npm run dev
```

## Como colocar em produção

Leia **[DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md)** — cobre, passo a passo,
tudo que precisa de uma ação humana (criar contas, gerar chaves, verificar
domínio de e-mail). Depois de ter as chaves, rode:

```bash
node scripts/setup.js
```

Isso automatiza: Git, GitHub, link + migrations do Supabase, criação dos
produtos no Stripe, e o primeiro deploy na Vercel.

## Arquitetura multi-tenant

Toda tabela de negócio tem uma coluna `tenant_id`. O isolamento entre
empresas é garantido por **Row Level Security no PostgreSQL**
(`supabase/migrations/0002_row_level_security.sql`) — ou seja, mesmo que
uma rota da API tenha um bug, o banco recusa devolver dado de um tenant
para o usuário de outro. Isso é mais forte do que filtrar `WHERE tenant_id
= ?` só no código da aplicação.

```
supabase/migrations/
  0001_initial_schema.sql       → tabelas e índices
  0002_row_level_security.sql   → isolamento multi-tenant + permissões por papel
  0003_signup_trigger.sql       → cria tenant + admin automaticamente no cadastro
  0004_storage_buckets.sql      → buckets de arquivo (currículos, documentos)
```

## Papéis e permissões

`admin`, `rh`, `gestor`, `colaborador` — aplicados via RLS no banco
(não apenas na interface). Ver `0002_row_level_security.sql` para a
matriz exata de quem pode ler/editar o quê.

## Fluxo de recrutamento automatizado

1. Candidato aplica pelo portal público → `POST /api/recrutamento/apply`
2. Currículo é enviado ao n8n (`N8N_WEBHOOK_URL_RESUME_PARSE`) para extração
   de nome/e-mail/telefone/habilidades
3. n8n devolve o resultado via `POST /api/webhooks/n8n`
4. RH aprova o candidato → `POST /api/recrutamento/[id]/approve` → cria
   usuário, profile e onboarding automaticamente

## Cobrança

`POST /api/stripe/checkout` cria a sessão de checkout. `POST
/api/stripe/webhook` escuta os eventos do Stripe e mantém
`tenants.subscription_status` sincronizado — upgrade, downgrade,
cancelamento e falha de pagamento são todos tratados.

## O que já está 100% funcional

- Landing pública em `/` (Liquid Glass, conversão para cadastro/login)
- Cadastro de empresa (cria tenant + admin automaticamente via trigger do banco)
- Login real (Supabase Auth)
- Setup inicial de 2FA (TOTP via Supabase MFA, com QR Code e fallback por chave manual)
- Verificação 2FA em logins seguintes (TOTP real, com a UI animada
  code-merge / LED chase / success-glow do protótipo)
- Logo Fortixx vetorial (badge 34×34 gold→amber + wordmark)
- Particle canvas animado no fundo (respeita prefers-reduced-motion)
- Dashboard consultando dados reais, isolados por tenant via RLS
- Portal público de vagas → candidatura → parsing via n8n → pipeline
- Aprovação de candidato → criação automática de colaborador + onboarding
- Checkout e assinatura recorrente via Stripe, com webhook completo
- Isolamento multi-tenant garantido no banco (não só na aplicação)

## O que ainda falta (seja honesto sobre isso antes de vender)

- **Visual completo do dashboard**: o design Liquid Glass (partículas,
  Dock, Ctrl+K, gráficos animados, organograma) está parcialmente aplicado
  (logo, particle canvas, design system global). Os módulos visuais do
  dashboard em si (gráficos, dock de navegação, organograma) existem nos
  protótipos HTML (`fortixx-plataforma.html`) mas ainda precisam ser
  portados para componentes React. O dashboard atual
  (`src/app/dashboard/page.tsx`) já consulta dados reais via RLS, é a
  base funcional sobre a qual esse visual entra.
- **Landing completa "Liquid Glass storytelling"**: a versão atual é a
  base de conversão (hero + 3 pilares + CTA + footer) usando o design
  system global. O storytelling pesado (storytelling stages, modal IA,
  Dock de scroll) do protótipo `fortixx-landing.html` pode ser portado
  em cima desta base quando o material de referência aparecer.
- **Página de preços pública**: idem — hoje o checkout é via
  `/api/stripe/checkout`; falta uma `/pricing` com cards comparativos.
- **OCR real de documentos**: hoje o schema e a rota de upload existem,
  mas a extração de texto de RG/CPF/comprovante ainda não está conectada
  a um serviço de OCR (Tesseract.js, Google Vision, ou AWS Textract).
- **Módulos de Escalas, Analytics e Configurações**: schema e RLS prontos
  no banco; as telas React ainda não foram construídas.

## Estrutura de pastas

```
src/
  app/
    api/            → rotas de backend (recrutamento, stripe, webhooks)
    auth/            → login, setup-2fa, verify
    dashboard/       → área logada
    register/        → cadastro de empresa
    page.tsx         → landing pública (Liquid Glass)
  components/
    Logo.tsx         → logo vetorial
    ParticleCanvas.tsx → fundo vivo com partículas conectadas
    dashboard/       → componentes do dashboard
  lib/
    supabase/        → clientes (browser, server, admin)
    stripe/          → cliente Stripe
    resend/          → cliente de e-mail
  middleware.ts      → refresh de sessão + proteção de rotas
  types/database.ts  → tipos TypeScript do schema (sincronizar com `npm run db:types`)
supabase/
  migrations/        → schema versionado
  seed.sql           → dados de demonstração para desenvolvimento local
n8n/workflows/       → automação de parsing de currículo
scripts/             → setup.js, stripe-setup.js, vercel-env-sync.js
```

## Comandos úteis

```bash
npm run dev            # desenvolvimento local
npm run build           # build de produção
npm run lint            # ESLint
npx tsc --noEmit         # checagem de tipos
npm run db:migrate       # aplica migrations no Supabase linkado
npm run db:types         # regenera src/types/database.ts a partir do banco real
```
