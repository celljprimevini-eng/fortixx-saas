'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * 2FA REAL via TOTP (Supabase Auth MFA). Visual 1:1 com o protótipo
 * fortixx-login.html: fusão dos 6 campos num componente único, LED chase,
 * linha conectora, varredura, sequência "Verificando... Processando...
 * Autorizando...", sucesso com anel dourado, erro com shake.
 *
 * A única coisa que deixou de ser simulada é o verifyCode(): antes
 * qualquer 6 dígitos passava (exceto "000000"); agora é validado de
 * verdade contra o fator TOTP cadastrado no Supabase.
 */
export default function VerifyPage() {
  const router = useRouter();
  const supabase = createClient();

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [disabled, setDisabled] = useState(false);
  const [errorState, setErrorState] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [merging, setMerging] = useState(false);
  const [ledRun, setLedRun] = useState(false);
  const [lineRun, setLineRun] = useState(false);
  const [scanRun, setScanRun] = useState(false);
  const [statusShow, setStatusShow] = useState(false);
  const [statusText, setStatusText] = useState('Verificando identidade...');
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successGlow, setSuccessGlow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(30);
  const [pulseIndex, setPulseIndex] = useState<number | null>(null);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  const allFilled = digits.every((d) => d.length === 1);

  const verifyCode = useCallback(async (sixDigitCode: string) => {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp?.[0];
    if (!totpFactor) {
      return { ok: false, message: 'Nenhum fator de 2FA configurado nesta conta.' };
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: totpFactor.id,
    });
    if (challengeError || !challenge) {
      return { ok: false, message: 'Não foi possível iniciar a verificação.' };
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code: sixDigitCode,
    });

    if (verifyError) {
      return { ok: false, message: 'Código incorreto. Verifique e tente novamente.' };
    }
    return { ok: true, message: '' };
  }, [supabase]);

  const beginVerification = useCallback(async () => {
    if (verifying || !allFilled) return;
    setVerifying(true);
    setDisabled(true);
    setErrorState(false);
    setErrorMsg('');

    setMerging(true);
    setLedRun(true);
    setLineRun(true);
    setTimeout(() => setScanRun(true), 50);

    setTimeout(() => {
      setStatusShow(true);
      setStatusText('Verificando identidade...');
    }, 500);

    setTimeout(() => setStatusText('Processando com Fortixx AI...'), 900);
    setTimeout(() => setStatusText('Autorizando acesso...'), 1300);

    setTimeout(async () => {
      const code = digits.join('');
      const result = await verifyCode(code);

      if (!result.ok) {
        setVerifying(false);
        setStatusShow(false);
        setShake(true);
        setMerging(false);
        setLedRun(false);
        setErrorState(true);
        setErrorMsg(result.message);
        setTimeout(() => setShake(false), 520);
        setTimeout(() => {
          setDigits(['', '', '', '', '', '']);
          setErrorState(false);
          setDisabled(false);
          inputRefs.current[0]?.focus();
        }, 650);
        return;
      }

      setStatusText('Identidade verificada com sucesso.');
      setTimeout(() => {
        setSuccess(true);
        setSuccessGlow(true);
        setTimeout(() => {
          setLeaving(true);
          setTimeout(() => router.push('/dashboard'), 350);
        }, 700);
      }, 300);
    }, 1700);
  }, [digits, allFilled, verifying, verifyCode, router]);

  useEffect(() => {
    if (allFilled) {
      const t = setTimeout(() => beginVerification(), 150);
      return () => clearTimeout(t);
    }
  }, [allFilled, beginVerification]);

  function handleChange(index: number, value: string) {
    const clean = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean) {
      setPulseIndex(index);
      setTimeout(() => setPulseIndex(null), 350);
      if (index < 5) inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6).split('');
    const next = [...digits];
    pasted.forEach((d, i) => { next[i] = d; });
    setDigits(next);
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  }

  async function handleResend() {
    if (resendSeconds > 0) return;
    setDigits(['', '', '', '', '', '']);
    setDisabled(false);
    setErrorState(false);
    setErrorMsg('');
    setStatusShow(false);
    setVerifying(false);
    setResendSeconds(30);
    inputRefs.current[0]?.focus();
  }

  return (
    <>
      <div className="ambient" aria-hidden="true">
        <div className="orb orb-1" />
      </div>
      <main className="login-main">
      <div className="login-card-wrap">
        <div className={`login-card glass ${successGlow ? 'success-glow' : ''} ${leaving ? 'leaving' : ''}`}>

          {!success && (
            <div className="login-step active" id="step2fa">
              <span className="login-eyebrow">Verificação em duas etapas</span>
              <h1 className="login-title">Confirme seu acesso</h1>
              <p className="login-sub">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>

              <div className={`code-zone ${shake ? 'shake' : ''} ${merging ? 'merging' : ''}`} id="codeZone">
                <div className="code-row" id="codeRow">
                  {digits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      className={`code-input ${pulseIndex === i ? 'filled-pulse' : ''} ${errorState ? 'error-state' : ''}`}
                      inputMode="numeric"
                      maxLength={1}
                      aria-label={`Dígito ${i + 1}`}
                      value={digit}
                      disabled={disabled}
                      onChange={(e) => handleChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={handlePaste}
                    />
                  ))}
                </div>
                <div className={`code-connect-line ${lineRun ? 'run' : ''}`} />
                <div className={`code-scan-sweep ${scanRun ? 'run' : ''}`} />
                <div className={`code-merge-frame ${ledRun ? 'run' : ''}`} aria-hidden="true" />
              </div>

              <p className="error-text">{errorMsg}</p>

              <div className={`verify-status-wrap ${statusShow ? 'show' : ''}`}>
                <div className="ai-pulse-icon" aria-hidden="true"><span /><span /><span /></div>
                <p className="verify-status-text">{statusText}</p>
              </div>

              <button className="btn btn-primary" disabled={!allFilled || verifying} onClick={beginVerification}>
                Verificar
              </button>

              <div className="resend-row">
                Não recebeu?{' '}
                <button className={`link-accent ${resendSeconds === 0 ? 'activated' : ''}`} disabled={resendSeconds > 0} onClick={handleResend}>
                  {resendSeconds > 0 ? `Reenviar código (${resendSeconds}s)` : 'Reenviar código'}
                </button>
              </div>
            </div>
          )}

          {success && (
            <div className="login-step active" id="stepSuccess">
              <div className="success-wrap">
                <div className="success-icon gold pulse">
                  <div className="success-icon-ring" />
                  <div className="success-icon-ring-outer" />
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <h1 className="login-title">Identidade verificada com sucesso.</h1>
                <p className="login-sub"><span className="spinner" aria-hidden="true" />&nbsp; Preparando seu painel...</p>
              </div>
            </div>
          )}

        </div>
      </div>
      </main>
    </>
  );
}
