'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Step = 'login' | 'forgot' | 'forgotSent';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [forgotEmail, setForgotEmail] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Sign-in via API route server-side — permite rate limit por IP+email
    // (mitiga V1 do code review: brute force / credential stuffing).
    // Supabase gerencia sessão via cookies no próprio response, então
    // não precisamos chamar signInWithPassword do client aqui.
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      // 429 → rate limit; 4xx → credenciais; 200 → redireciona
      if (res.status === 429) {
        setError('Muitas tentativas. Aguarde alguns minutos e tente de novo.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError('E-mail ou senha incorretos.');
        setLoading(false);
        return;
      }

      let data: { redirect?: string; error?: string; raw?: string };
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error('[login] response not JSON', { status: res.status, parseErr });
        setError(`Resposta inválida do servidor (status ${res.status}). Abra o console (F12) e me manda o erro.`);
        setLoading(false);
        return;
      }

      // Debug: log no console pra diagnosticar fluxo quebrado
      console.log('[login] API response', { status: res.status, body: data });

      if (!data.redirect) {
        setError(data.error || 'Resposta inesperada do servidor.');
        setLoading(false);
        return;
      }

      // refresh() garante que o server component /dashboard vê a sessão nova
      router.push(data.redirect);
      router.refresh();
    } catch (err) {
      console.error('[login] fetch failed', err);
      setError('Não foi possível entrar. Tente novamente.');
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    });
    // Sempre mostra a mesma confirmação, exista ou não o e-mail —
    // não vazamos quais e-mails têm conta (mesmo padrão de antes).
    setStep('forgotSent');
  }

  return (
    <>
      <div className="ambient" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <header className="login-topbar">
        <a className="logo" href="/">
          <span className="logo-badge">F</span>Fortixx
        </a>
      </header>

      <main className="login-main">
        <div className="login-card-wrap">
          <div className="login-card glass">

            {step === 'login' && (
              <div className="login-step active">
                <span className="login-eyebrow">Acesso à plataforma</span>
                <h1 className="login-title">Entrar na sua conta</h1>
                <p className="login-sub">Acesse o painel de RH da sua empresa.</p>

                <form onSubmit={handleLogin} noValidate>
                  <div className="form-field">
                    <label className="form-label" htmlFor="loginEmail">E-mail corporativo</label>
                    <input
                      id="loginEmail"
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
                    <label className="form-label" htmlFor="loginPassword">Senha</label>
                    <div className="input-wrap">
                      <input
                        id="loginPassword"
                        className="form-input"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        style={{ paddingRight: 42 }}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="pw-toggle"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="login-row-between">
                    <label className="checkbox-row">
                      <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                      Lembrar de mim
                    </label>
                    <button type="button" className="link-accent" onClick={() => setStep('forgot')}>
                      Esqueci minha senha
                    </button>
                  </div>
                  {error && <p className="error-text" role="alert">{error}</p>}
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Entrando…' : 'Entrar →'}
                  </button>
                </form>

                <div className="login-divider">ou</div>
                <p className="login-sub" style={{ textAlign: 'center' }}>
                  Ainda não é cliente?{' '}
                  <a href="/register" className="link-accent" style={{ display: 'inline' }}>Criar conta</a>
                </p>
              </div>
            )}

            {step === 'forgot' && (
              <div className="login-step active">
                <button className="back-row" onClick={() => setStep('login')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M19 12H5M11 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Voltar
                </button>
                <span className="login-eyebrow">Recuperação de senha</span>
                <h1 className="login-title">Esqueceu sua senha?</h1>
                <p className="login-sub">Informe seu e-mail. Se ele existir em nossa base, você recebe um link para criar uma nova senha.</p>

                <form onSubmit={handleForgotPassword} noValidate>
                  <div className="form-field">
                    <label className="form-label" htmlFor="forgotEmail">E-mail corporativo</label>
                    <input
                      id="forgotEmail"
                      className="form-input"
                      type="email"
                      placeholder="voce@empresa.com"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-primary" type="submit">Enviar link de recuperação</button>
                </form>
              </div>
            )}

            {step === 'forgotSent' && (
              <div className="login-step active">
                <div className="success-wrap">
                  <div className="success-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                      <path d="M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
                    </svg>
                  </div>
                  <h1 className="login-title">Verifique seu e-mail</h1>
                  <p className="login-sub">
                    Se {forgotEmail} estiver em nossa base, você receberá um link de recuperação em poucos minutos.
                  </p>
                  <button className="btn btn-ghost" onClick={() => setStep('login')}>Voltar para o login</button>
                </div>
              </div>
            )}

          </div>
        </div>
        <p className="login-foot-note">© 2026 Fortixx · <a href="/termos">Termos de Uso</a> · <a href="/privacidade">Privacidade</a></p>
      </main>
    </>
  );
}
