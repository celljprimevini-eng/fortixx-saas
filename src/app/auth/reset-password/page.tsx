'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Página final do fluxo "esqueci minha senha". O link do e-mail de
 * recuperação (supabase.auth.resetPasswordForEmail) traz um token de
 * sessão na própria URL (#access_token=...) — o createBrowserClient
 * detecta isso sozinho (detectSessionInUrl) e já loga o usuário numa
 * sessão temporária de recovery. Daqui só falta chamar updateUser()
 * com a senha nova.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session);
      setChecking(false);
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não são iguais.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError('Não foi possível atualizar a senha. Solicite um novo link de recuperação.');
      return;
    }

    setDone(true);
    setTimeout(() => router.push('/dashboard'), 2000);
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

            {checking && (
              <div className="login-step active">
                <p className="login-sub" style={{ textAlign: 'center' }}>Verificando link…</p>
              </div>
            )}

            {!checking && !validSession && (
              <div className="login-step active">
                <span className="login-eyebrow">Link inválido ou expirado</span>
                <h1 className="login-title">Esse link não é mais válido</h1>
                <p className="login-sub">
                  Links de redefinição de senha expiram depois de um tempo. Volte ao login e peça um novo.
                </p>
                <a className="btn btn-primary" href="/auth/login">Voltar para o login</a>
              </div>
            )}

            {!checking && validSession && !done && (
              <div className="login-step active">
                <span className="login-eyebrow">Recuperação de senha</span>
                <h1 className="login-title">Crie sua nova senha</h1>
                <p className="login-sub">Escolha uma senha forte com pelo menos 8 caracteres.</p>

                <form onSubmit={handleSubmit} noValidate>
                  <div className="form-field">
                    <label className="form-label" htmlFor="newPassword">Nova senha</label>
                    <div className="input-wrap">
                      <input
                        id="newPassword"
                        className="form-input"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 8 caracteres"
                        autoComplete="new-password"
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
                  <div className="form-field">
                    <label className="form-label" htmlFor="confirmPassword">Confirme a nova senha</label>
                    <input
                      id="confirmPassword"
                      className="form-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  {error && <p className="error-text" role="alert">{error}</p>}
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Salvando…' : 'Salvar nova senha →'}
                  </button>
                </form>
              </div>
            )}

            {done && (
              <div className="login-step active">
                <div className="success-wrap">
                  <div className="success-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h1 className="login-title">Senha atualizada!</h1>
                  <p className="login-sub">Redirecionando para o seu painel…</p>
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
