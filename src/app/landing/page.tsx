import Link from 'next/link';

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        textAlign: 'center',
        background:
          'radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.15) 0%, transparent 60%), #0a0a0f',
        color: '#fafafa',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: '0.75rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'rgba(250, 250, 250, 0.5)',
          marginBottom: '1.5rem',
        }}
      >
        Fortixx · v1.0
      </div>

      <h1
        style={{
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          fontWeight: 700,
          lineHeight: 1.1,
          margin: 0,
          background:
            'linear-gradient(135deg, #fafafa 0%, #a78bfa 50%, #fbbf24 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        RH sem fricção.
      </h1>

      <p
        style={{
          maxWidth: '38rem',
          fontSize: '1.125rem',
          lineHeight: 1.6,
          color: 'rgba(250, 250, 250, 0.7)',
          margin: '1.5rem 0 3rem',
        }}
      >
        Centralize recrutamento, onboarding e atendimento ao colaborador em um só
        lugar. Multi-tenant, com IA nativa, e sem a bagunça dos ERPs tradicionais.
      </p>

      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <Link
          href="/register"
          style={{
            padding: '0.875rem 1.75rem',
            background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '0.625rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4)',
            transition: 'transform 0.2s',
          }}
        >
          Começar grátis
        </Link>

        <Link
          href="/auth/login"
          style={{
            padding: '0.875rem 1.75rem',
            background: 'transparent',
            color: '#fafafa',
            textDecoration: 'none',
            borderRadius: '0.625rem',
            fontWeight: 600,
            fontSize: '0.95rem',
            border: '1px solid rgba(250, 250, 250, 0.2)',
            transition: 'border-color 0.2s',
          }}
        >
          Já tenho conta
        </Link>
      </div>

      <div
        style={{
          marginTop: '5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1.5rem',
          maxWidth: '48rem',
          width: '100%',
        }}
      >
        {[
          { label: 'Multi-tenant', desc: 'RLS no banco' },
          { label: 'IA nativa', desc: 'Parsing de currículo' },
          { label: 'Stripe + Resend', desc: 'Pronto pra produção' },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              padding: '1.25rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              {item.label}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'rgba(250, 250, 250, 0.5)',
                marginTop: '0.25rem',
              }}
            >
              {item.desc}
            </div>
          </div>
        ))}
      </div>

      <footer
        style={{
          marginTop: '5rem',
          fontSize: '0.75rem',
          color: 'rgba(250, 250, 250, 0.4)',
        }}
      >
        © 2026 Fortixx · Premium HR com IA
      </footer>
    </main>
  );
}
