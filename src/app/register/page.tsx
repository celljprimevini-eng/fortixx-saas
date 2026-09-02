'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    setLoading(true);

    // O trigger handle_new_user() (migration 0003) cria automaticamente
    // o tenant (empresa) e o profile como 'admin' assim que este usuário
    // é inserido em auth.users — não precisa de nenhuma chamada extra aqui.
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { company_name: companyName, full_name: fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/login`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message.includes('already registered')
          ? 'Este e-mail já está cadastrado.'
          : 'Não foi possível criar a conta. Tente novamente.'
      );
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <main className="login-main">
        <div className="login-card-wrap">
          <div className="login-card glass">
            <div className="login-step active">
              <div className="success-wrap">
                <div className="success-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                    <path d="M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
                  </svg>
                </div>
                <h1 className="login-title">Confirme seu e-mail</h1>
                <p className="login-sub">
                  Enviamos um link de confirmação para <strong>{email}</strong>. Depois de confirmar, sua empresa
                  &ldquo;{companyName}&rdquo; já estará pronta e você poderá entrar.
                </p>
                <a className="btn btn-ghost" href="/auth/login">Ir para o login</a>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="ambient" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <ThemeToggle className="theme-toggle-fixed" />

      <header className="login-topbar">
        <a className="logo" href="/">
          <Logo />
        </a>
      </header>

      <main className="login-main">
        <div className="login-card-wrap">
          <div className="login-card glass">
            <div className="login-step active">
              <span className="login-eyebrow">Comece agora</span>
              <h1 className="login-title">Criar sua conta</h1>
              <p className="login-sub">14 dias grátis, sem cartão de crédito. Sua empresa fica pronta em segundos.</p>

              <form onSubmit={handleRegister} noValidate>
                <div className="form-field">
                  <label className="form-label" htmlFor="companyName">Nome da empresa</label>
                  <input
                    id="companyName"
                    className="form-input"
                    type="text"
                    placeholder="Minha Empresa LTDA"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="fullName">Seu nome</label>
                  <input
                    id="fullName"
                    className="form-input"
                    type="text"
                    placeholder="Seu nome completo"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="regEmail">E-mail corporativo</label>
                  <input
                    id="regEmail"
                    className="form-input"
                    type="email"
                    placeholder="voce@empresa.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="regPassword">Senha</label>
                  <input
                    id="regPassword"
                    className="form-input"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && <p className="error-text" role="alert">{error}</p>}
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading ? 'Criando conta…' : 'Criar conta →'}
                </button>
              </form>

              <div className="login-divider">ou</div>
              <p className="login-sub" style={{ textAlign: 'center' }}>
                Já tem uma conta?{' '}
                <a href="/auth/login" className="link-accent" style={{ display: 'inline' }}>Entrar</a>
              </p>
            </div>
          </div>
        </div>
        <p className="login-foot-note">© 2026 Fortixx · <a href="/termos">Termos de Uso</a> · <a href="/privacidade">Privacidade</a></p>
      </main>
    </>
  );
}
