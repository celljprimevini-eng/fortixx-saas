'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';

/**
 * Setup inicial de 2FA (TOTP) — usuário acabou de logar e não tem fator
 * cadastrado. Mostra QR Code, pede confirmação com código de 6 dígitos
 * do Google Authenticator / 1Password / Authy.
 *
 * Fluxo:
 * 1. Verifica que tem sessão ativa (sem isso, enroll() falha)
 * 2. Chama supabase.auth.mfa.enroll({factorType: 'totp', friendlyName: 'Fortixx'})
 * 3. Recebe {qr_code (SVG string), secret, factor.id}
 * 4. Mostra QR Code na tela
 * 5. Usuário escaneia com app autenticador, digita código de 6 dígitos
 * 6. Chama supabase.auth.mfa.verify({factorId, challengeId, code})
 *    - challengeId vem de supabase.auth.mfa.challenge({factorId})
 * 7. Se OK → /dashboard
 */
export default function Setup2FAPage() {
  const router = useRouter();
  const supabase = createClient();

  const [qrSvg, setQrSvg] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function enroll() {
      try {
        // 1. Verificar que tem sessão (sem isso, mfa.enroll retorna 401)
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData?.user) {
          if (mounted) {
            setError('Sessão expirou. Faça login novamente.');
            setLoading(false);
            setTimeout(() => router.push('/auth/login'), 1500);
          }
          return;
        }

        // 2. Se já tem TOTP enrolled, redireciona direto pro dashboard
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const hasVerifiedTotp = factorsData?.totp?.some((f) => f.status === 'verified');
        if (hasVerifiedTotp) {
          router.push('/dashboard');
          return;
        }

        // 3. Enroll novo fator TOTP
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'Fortixx',
        });

        if (enrollError || !data) {
          console.error('[setup-2fa] enroll failed:', enrollError);
          if (mounted) {
            setError(`Não foi possível gerar QR Code: ${enrollError?.message ?? 'erro desconhecido'}`);
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          setQrSvg(data.totp.qr_code);
          setSecret(data.totp.secret);
          setFactorId(data.id);
          setLoading(false);
        }
      } catch (err) {
        console.error('[setup-2fa] unexpected error:', err);
        if (mounted) {
          setError(`Erro inesperado: ${err instanceof Error ? err.message : String(err)}`);
          setLoading(false);
        }
      }
    }

    enroll();
    return () => { mounted = false; };
  }, [supabase, router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Código deve ter 6 dígitos.');
      return;
    }
    setVerifying(true);
    setError('');

    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError || !challenge) {
        setError(`Não foi possível iniciar verificação: ${challengeError?.message ?? 'erro'}`);
        setVerifying(false);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) {
        setError(`Código incorreto: ${verifyError.message}`);
        setCode('');
        setVerifying(false);
        return;
      }
      router.push('/dashboard');
    } catch (err) {
      setError(`Erro: ${err instanceof Error ? err.message : String(err)}`);
      setVerifying(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  if (loading) {
    return (
      <main className="login-main">
        <header className="login-topbar">
          <Logo />
        </header>
        <div className="login-card-wrap">
          <div className="login-card glass">
            <p className="login-sub">Gerando QR Code...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !qrSvg) {
    return (
      <main className="login-main">
        <header className="login-topbar">
          <Logo />
        </header>
        <div className="login-card-wrap">
          <div className="login-card glass">
            <span className="login-eyebrow">Erro</span>
            <h1 className="login-title">Setup 2FA</h1>
            <p className="login-sub" style={{ color: 'var(--red, #f87171)' }}>{error}</p>
            <button onClick={handleLogout} className="btn btn-primary" style={{ marginTop: 16 }}>
              Voltar pro login
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-main">
      <header className="login-topbar">
        <Logo />
      </header>
      <div className="login-card-wrap">
        <div className="login-card glass">
          <span className="login-eyebrow">Configuração obrigatória</span>
          <h1 className="login-title">Ative o 2FA</h1>
          <p className="login-sub">
            Escaneie o QR Code com Google Authenticator, 1Password, Authy ou outro app autenticador.
            Depois, digite o código de 6 dígitos para confirmar.
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '20px 0',
              background: 'white',
              borderRadius: 12,
              margin: '16px 0',
            }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />

          <details style={{ marginBottom: 16, color: 'var(--muted)', fontSize: '.85rem' }}>
            <summary style={{ cursor: 'pointer' }}>Não consegue escanear? Use a chave manual</summary>
            <code style={{
              display: 'block',
              marginTop: 8,
              padding: 8,
              background: 'var(--bg-2)',
              borderRadius: 6,
              wordBreak: 'break-all',
            }}>
              {secret}
            </code>
          </details>

          <form onSubmit={handleVerify}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="code-input"
              style={{
                width: '100%',
                fontSize: '1.5rem',
                textAlign: 'center',
                letterSpacing: '0.4em',
                padding: '12px',
                marginBottom: 12,
              }}
              disabled={verifying}
              autoFocus
            />
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={verifying || code.length !== 6}>
              {verifying ? 'Verificando...' : 'Confirmar e entrar'}
            </button>
          </form>

          <button
            type="button"
            className="link-accent"
            onClick={handleLogout}
            style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Sair
          </button>
        </div>
      </div>
    </main>
  );
}