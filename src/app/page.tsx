import Link from 'next/link';
import { Logo } from '@/components/Logo';

/**
 * Landing pública do Fortixx.
 *
 * Sem rota dedicada em /landing — a raiz ("/") É a landing, e o login fica
 * em /auth/login. Caso o usuário queira ir direto pro painel autenticado,
 * o middleware manda ele pro /dashboard se já tiver sessão.
 *
 * Visual: usa o design system Liquid Glass (globals.css) já existente.
 * Sem libs extras. O ParticleCanvas é plugado no RootLayout, então roda
 * aqui também sem custo de import.
 *
 * Estrutura:
 *  1. Topbar com Logo + CTAs (Entrar / Começar grátis)
 *  2. Hero (eyebrow + título + sub + 2 CTAs)
 *  3. Três pilares (Recrutamento / Onboarding / Colaborador) em cards glass
 *  4. Footer
 */

export default function LandingPage() {
  return (
    <>
      <div className="ambient" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <header className="login-topbar">
        <Logo />
        <nav style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link
            href="/auth/login"
            className="link-accent"
            style={{ padding: '8px 14px', borderRadius: 100 }}
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="btn btn-primary"
            style={{ width: 'auto', marginTop: 0, padding: '10px 18px', fontSize: '.85rem' }}
          >
            Começar grátis
          </Link>
        </nav>
      </header>

      <main
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1100,
          margin: '0 auto',
          padding: '60px 24px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: 80,
        }}
      >
        {/* HERO */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 24,
            paddingTop: 40,
          }}
        >
          <span
            className="login-eyebrow"
            style={{ display: 'inline-block' }}
          >
            RH sem fricção
          </span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              maxWidth: 780,
            }}
          >
            Recrute, contrate e cuide do time — <br />
            tudo num só lugar.
          </h1>
          <p
            className="login-sub"
            style={{ maxWidth: 620, fontSize: '1.05rem' }}
          >
            Fortixx centraliza seu recrutamento, onboarding e atendimento ao colaborador
            com a segurança e a velocidade que sua operação precisa.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link
              href="/register"
              className="btn btn-primary"
              style={{ width: 'auto', padding: '14px 28px' }}
            >
              Criar conta gratuita →
            </Link>
            <Link
              href="/auth/login"
              className="btn btn-ghost"
              style={{ width: 'auto', padding: '14px 24px' }}
            >
              Já tenho conta
            </Link>
          </div>
          <p
            style={{
              marginTop: 4,
              fontSize: '.78rem',
              color: 'var(--text-3)',
            }}
          >
            14 dias de teste · sem cartão · cancele quando quiser
          </p>
        </section>

        {/* TRÊS PILARES */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 18,
          }}
        >
          <Pillar
            tag="01"
            title="Recrutamento"
            body="Publique vagas, receba candidaturas com parsing automático de currículo e mova candidatos pelo pipeline sem planilha."
          />
          <Pillar
            tag="02"
            title="Onboarding"
            body="Acompanhe cada novo colaborador do dia 1 ao dia 90. Documentos, tarefas e checklist num fluxo único."
          />
          <Pillar
            tag="03"
            title="Colaborador"
            body="Atendimento, solicitações e documentos em um portal só. Isolado por empresa via Row Level Security."
          />
        </section>

        {/* CTA FINAL */}
        <section
          className="glass"
          style={{
            borderRadius: 'var(--radius-xl)',
            padding: '44px 32px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 'clamp(1.4rem, 3vw, 1.9rem)',
              maxWidth: 620,
            }}
          >
            Sua empresa pronta pra rodar em uma tarde.
          </h2>
          <p className="login-sub" style={{ maxWidth: 540 }}>
            Crie sua conta, configure 2FA e convide seu time. O Fortixx cuida do resto.
          </p>
          <Link
            href="/register"
            className="btn btn-primary"
            style={{ width: 'auto', padding: '14px 28px', marginTop: 6 }}
          >
            Começar agora →
          </Link>
        </section>

        <footer
          style={{
            textAlign: 'center',
            fontSize: '.78rem',
            color: 'var(--text-3)',
          }}
        >
          © 2026 Fortixx · <a href="/termos">Termos de Uso</a> ·{' '}
          <a href="/privacidade">Privacidade</a>
        </footer>
      </main>
    </>
  );
}

function Pillar({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <div
      className="glass"
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: '28px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 200,
      }}
    >
      <span
        className="login-eyebrow"
        style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: 100,
          border: '1px solid var(--border)',
          background: 'var(--surface-strong)',
        }}
      >
        {tag}
      </span>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: '1.25rem',
          marginTop: 2,
        }}
      >
        {title}
      </h3>
      <p className="login-sub" style={{ marginTop: 0 }}>
        {body}
      </p>
    </div>
  );
}