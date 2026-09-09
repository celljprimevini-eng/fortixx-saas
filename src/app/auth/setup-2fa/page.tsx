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
  const [success, setSuccess] = useState(false);
  const [successGlow, setSuccessGlow] = useState(false);
  const [leaving, setLeaving] = useState(false);

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

        // 2. Se já tem TOTP verificado, redireciona direto pro dashboard
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const hasVerifiedTotp = factorsData?.totp?.some((f) => f.status === 'verified');
        if (hasVerifiedTotp) {
          router.push('/dashboard');
          return;
        }

        // 2b. Remove fatores TOTP NÃO-verificados (setup anterior que foi
        // abandonado: fechou a aba antes de confirmar o código). Sem isso, o
        // enroll abaixo falha com "factor already exists" e a tela abre sem
        // QR e sem chave manual — que foi exatamente o bug relatado.
        const staleTotp = (factorsData?.totp ?? []).filter((f) => f.status !== 'verified');
        for (const f of staleTotp) {
          await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
        }

        // 3. Enroll novo fator TOTP. friendlyName único (timestamp) pra nunca
        // colidir com um resquício que a limpeza acima não pegou.
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `Fortixx ${Date.now()}`,
        });

        if (enrollError || !data) {
          console.error('[setup-2fa] enroll failed:', enrollError);
          if (mounted) {
            setError(`Não foi possível gerar o QR Code: ${enrollError?.message ?? 'erro desconhecido'}. Tente recarregar a página.`);
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

      // Sucesso — sequência de animação (mesma linguagem visual do /auth/verify):
      // check dourado com anéis pulsando → glow no card → card sai → dashboard.
      setSuccess(true);
      setSuccessGlow(true);
      setTimeout(() => {
        setLeaving(true);
        setTimeout(() => router.push('/dashboard'), 480);
      }, 1400);
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
      <>
        <div className="ambient" aria-hidden="true">
          <div className="orb orb-1" />
        </div>
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
      </>
    );
  }

  if (error && !qrSvg) {
    return (
      <>
        <div className="ambient" aria-hidden="true">
          <div className="orb orb-1" />
        </div>
        <main className="login-main">
          <header className="login-topbar">
            <Logo />
          </header>
          <div className="login-card-wrap">
            <div className="login-card glass">
              <span className="login-eyebrow">Erro</span>
              <h1 className="login-title">Setup 2FA</h1>
              <p className="login-sub" style={{ color: 'var(--red, #f87171)' }}>{error}</p>
              <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ marginTop: 16 }}>
                Tentar de novo
              </button>
              <button onClick={handleLogout} className="link-accent" style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
                Voltar pro login
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <div className="ambient" aria-hidden="true">
        <div className="orb orb-1" />
      </div>
      <main className="login-main">
      <header className="login-topbar">
        <Logo />
      </header>
      <div className="login-card-wrap">
        <div className={`login-card glass ${successGlow ? 'success-glow' : ''} ${leaving ? 'leaving' : ''}`}>

        {success ? (
          <div className="login-step active">
            <div className="success-wrap">
              <div className="success-icon gold pulse">
                <div className="success-icon-ring" />
                <div className="success-icon-ring-outer" />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M5 13l4 4L19 7" /></svg>
              </div>
              <h1 className="login-title">2FA ativado.</h1>
              <p className="login-sub"><span className="spinner" aria-hidden="true" />&nbsp; Preparando seu painel...</p>
            </div>
          </div>
        ) : (
          <>
          <span className="login-eyebrow">Configuração obrigatória</span>
          <h1 className="login-title">Ative o 2FA</h1>
          <p className="login-sub">
            Escaneie o QR Code com Google Authenticator, 1Password, Authy ou outro app autenticador.
            Depois, digite o código de 6 dígitos para confirmar.
          </p>

          {/*
            O Supabase (auth-js) SEMPRE devolve `qr_code` como
            "data:image/svg+xml;utf-8,<svg...>" com o SVG CRU — sem
            url-encode. Isso quebra num <img>: o `#` das cores é lido como
            fragmento e corta o SVG (era o "QR bugado"). Solução: tirar o
            prefixo do data URI e injetar o <svg> direto no DOM — SVG cru é
            HTML válido e sempre renderiza. A classe .qr-2fa (globals.css)
            força o tamanho.
          */}
          <div
            className="qr-2fa"
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: 20,
              background: 'white',
              borderRadius: 12,
              margin: '16px 0',
            }}
            dangerouslySetInnerHTML={{
              __html: qrSvg.replace(/^data:image\/svg\+xml;(?:utf-8|charset=utf-8),/i, ''),
            }}
          />

          <div style={{ marginBottom: 16, fontSize: '.85rem' }}>
            <p className="login-sub" style={{ margin: '0 0 6px' }}>
              Não consegue escanear? Digite esta chave no app:
            </p>
            <code
              onClick={() => { navigator.clipboard?.writeText(secret).catch(() => {}); }}
              title="Clique para copiar"
              style={{
                display: 'block',
                padding: 10,
                background: 'var(--bg-2)',
                borderRadius: 6,
                wordBreak: 'break-all',
                letterSpacing: '.08em',
                cursor: 'pointer',
                userSelect: 'all',
              }}
            >
              {secret || '—'}
            </code>
          </div>

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
          </>
        )}
        </div>
      </div>
      </main>
    </>
  );
}