# Checklist de Deploy — Fortixx

Este documento lista, sem enrolação, tudo que precisa de uma ação humana
sua antes do sistema ficar 100% operacional. `scripts/setup.js` automatiza
tudo que é automatizável por linha de comando; o que sobra aqui só pode
ser feito por você porque exige e-mail, senha, aceite de termos ou cartão
de crédito — nenhuma IA ou script tem permissão de fazer isso por você,
por segurança.

## 1. Criar as contas (gratuitas para começar)

- [ ] **Supabase** — https://supabase.com → New Project. Anote a senha do banco.
- [ ] **Vercel** — https://vercel.com → sign up com sua conta GitHub.
- [ ] **GitHub** — se ainda não tiver, https://github.com/signup.
- [ ] **Stripe** — https://dashboard.stripe.com/register. Comece em modo Test.
- [ ] **Resend** — https://resend.com/signup.
- [ ] **n8n Cloud** — https://n8n.io (ou self-host; o workflow em `n8n/workflows/` funciona nos dois).
- [ ] **Cloudflare** (opcional, só se for usar domínio próprio com proxy/CDN) — https://dash.cloudflare.com/sign-up.

## 2. Coletar as chaves

Copie `.env.example` para `.env.local` e preencha:

| Variável | Onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `SUPABASE_PROJECT_REF` | Supabase → Project Settings → General |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `RESEND_API_KEY` | Resend → API Keys |
| `RESEND_FROM_EMAIL` | Precisa ser um domínio verificado em Resend → Domains (ver passo 5) |
| `N8N_WEBHOOK_URL_RESUME_PARSE`, `N8N_WEBHOOK_SECRET` | Ver passo 6 |

`STRIPE_WEBHOOK_SECRET` e os 3 `STRIPE_PRICE_*` são preenchidos automaticamente
pelos scripts nos passos 3 e 4 abaixo — não precisa copiar manualmente.

## 3. Rodar o setup automático

```bash
npm install
node scripts/setup.js
```

Isso faz automaticamente: inicializa o Git, oferece criar o repo no GitHub,
linka e aplica as migrations no Supabase, cria os produtos no Stripe, e
oferece fazer o primeiro deploy na Vercel.

## 4. Configurar o webhook do Stripe

O Stripe precisa saber para onde mandar eventos (pagamento confirmado,
assinatura cancelada, etc). Isso só existe depois do primeiro deploy:

- [ ] Depois do deploy, copie a URL: `https://SEU-APP.vercel.app/api/stripe/webhook`
- [ ] Stripe → Developers → Webhooks → Add endpoint → cole a URL
- [ ] Selecione os eventos: `checkout.session.completed`, `customer.subscription.updated`,
      `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] Copie o "Signing secret" gerado e cole em `STRIPE_WEBHOOK_SECRET` no `.env.local`
- [ ] Rode `node scripts/vercel-env-sync.js` de novo para atualizar a Vercel com esse valor
- [ ] Redeploy: `vercel --prod`

## 5. Verificar domínio de e-mail no Resend

Sem isso, `RESEND_FROM_EMAIL` não consegue enviar nada:

- [ ] Resend → Domains → Add Domain → seu domínio
- [ ] Adicione os registros DNS (SPF, DKIM) que o Resend mostrar
      — se o domínio estiver na Cloudflare, é colar e salvar
- [ ] Aguarde o status mudar para "Verified" (minutos a poucas horas)

## 6. Importar e ativar o workflow do n8n

- [ ] No n8n, importe `n8n/workflows/resume-parse.json`
- [ ] Configure a credencial de HTTP usada no node de callback para incluir
      o header `X-Webhook-Secret` com o mesmo valor de `N8N_WEBHOOK_SECRET`
- [ ] Ative o workflow (toggle "Active")
- [ ] Copie a URL do webhook gerada pelo node de trigger e cole em
      `N8N_WEBHOOK_URL_RESUME_PARSE`

## 7. Domínio próprio (opcional)

- [ ] Vercel → seu projeto → Settings → Domains → adicione seu domínio
- [ ] Se o domínio estiver na Cloudflare: adicione o CNAME que a Vercel pedir,
      com o proxy (nuvem laranja) desativado inicialmente até confirmar que
      funciona, para evitar conflito de SSL
- [ ] Atualize `NEXT_PUBLIC_APP_URL` no `.env.local` para o domínio final e
      rode `node scripts/vercel-env-sync.js` + `vercel --prod` de novo

## 8. Criar o primeiro usuário administrador

- [ ] Acesse `https://seu-dominio.com/register`
- [ ] Cadastre sua empresa — o trigger do banco cria automaticamente o
      tenant e te torna admin
- [ ] Confirme o e-mail (Supabase Auth manda isso sozinho, desde que o
      SMTP padrão do Supabase esteja ativo — para volume alto, configure
      SMTP customizado em Supabase → Authentication → Email Templates)

## 9. Ativar 2FA de verdade (opcional, recomendado)

O fluxo de 2FA já está codificado contra o MFA real do Supabase. Para
habilitar, o usuário precisa cadastrar um fator TOTP — isso requer uma
tela de "configurar autenticador" que ainda não existe neste pacote
(ver README.md → "O que ainda falta").

## 10. Configurar o deploy automático (GitHub Actions)

O workflow em `.github/workflows/deploy.yml` builda, testa e faz deploy
sozinho a cada push em `main` — mas precisa que estes segredos existam em
GitHub → seu repositório → Settings → Secrets and variables → Actions:

| Secret | Onde conseguir |
|---|---|
| Todas as variáveis de `.env.example` | mesmas fontes do passo 2 |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | rode `vercel link` localmente uma vez; os IDs aparecem em `.vercel/project.json` (não commitar esse arquivo) |
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens → Generate |

Sem isso, o workflow ainda roda lint/typecheck/build em cada PR (útil por
si só), mas os jobs de deploy e migração de banco falham por falta de
credencial — o próprio log do GitHub Actions deixa claro qual secret falta.


---

**Depois de marcar tudo acima, o sistema está operacional de ponta a
ponta**: cadastro → login → 2FA (se configurado) → dashboard com dados
reais → cobrança recorrente via Stripe → e-mails transacionais via
Resend → parsing de currículo via n8n.
