'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * 2FA REAL via TOTP (Supabase Auth MFA). Animação em camadas empilhadas
 * (crossfade), igual ao vídeo de referência analisado quadro a quadro:
 * NÃO é um slide de caixas convergindo pro centro — é um formulário que
 * desaparece (fade + scale) enquanto um spinner (mesma posição/tamanho)
 * aparece por cima, e depois o spinner dá lugar ao check de sucesso.
 *
 * verifyCode() é real (Supabase MFA), não simulado.
 */
type Phase = 'idle' | 'verifying' | 'success';

export default function VerifyPage() {
  const router = useRouter();
  const supabase = createClient();

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [disabled, setDisabled] = useState(false);
  const [errorState, setErrorState] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [checkDraw, setCheckDraw] = useState(false);
  const [successGlow, setSuccessGlow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(30);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  const allFilled = digits.every((d) => d.length === 1);

  const verifyCode = useCallback(async (sixDigitCode: string) => {
    // Todas as chamadas do Supabase abaixo podem REJEITAR a Promise (rede
    // caindo no meio, timeout, resposta inesperada) em vez de só retornar um
    // `error` no objeto — sem o try/catch, uma rejeição aqui travava a tela
    // pra sempre.
    try {
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
    } catch (err) {
      console.error('[verify] erro inesperado na verificação:', err);
      return { ok: false, message: 'Erro de conexão. Tente novamente.' };
    }
  }, [supabase]);

  const beginVerification = useCallback(async () => {
    if (phase !== 'idle' || !allFilled) return;
    setDisabled(true);
    setErrorState(false);
    setErrorMsg('');
    setPhase('verifying');

    const code = digits.join('');
    const result = await verifyCode(code);

    if (!result.ok) {
      // Volta o formulário (o vídeo de referência não cobre o caso de
      // erro — mantido do jeito que já funcionava: shake + mensagem).
      setPhase('idle');
      setShake(true);
      setErrorState(true);
      setErrorMsg(result.message);
      setTimeout(() => setShake(false), 520);
      setTimeout(() => {
        setDigits(['', '', '', '', '', '']);
        setErrorState(false);
        setDisabled(false);
        setActiveIndex(0);
        inputRefs.current[0]?.focus();
      }, 650);
      return;
    }

    setPhase('success');
    setSuccessGlow(true);
    setTimeout(() => setCheckDraw(true), 120);
    setTimeout(() => {
      setLeaving(true);
      setTimeout(() => router.push('/dashboard'), 500);
    }, 1600);
  }, [digits, allFilled, phase, verifyCode, router]);

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
      const nextIndex = index < 5 ? index + 1 : -1;
      setActiveIndex(nextIndex);
      if (nextIndex >= 0) inputRefs.current[nextIndex]?.focus();
    } else {
      setActiveIndex(index);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      setActiveIndex(index - 1);
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
    setActiveIndex(pasted.length >= 6 ? -1 : focusIndex);
    inputRefs.current[focusIndex]?.focus();
  }

  async function handleResend() {
    if (resendSeconds > 0) return;
    setDigits(['', '', '', '', '', '']);
    setDisabled(false);
    setErrorState(false);
    setErrorMsg('');
    setPhase('idle');
    setActiveIndex(0);
    setResendSeconds(30);
    inputRefs.current[0]?.focus();
  }

  const isVerifying = phase === 'verifying';
  const isSuccess = phase === 'success';

  return (
    <>
      <div className="ambient" aria-hidden="true">
        <div className="orb orb-1" />
      </div>
      <main className="login-main">
      <div className="login-card-wrap">
        <div className={`login-card glass verify-2fa ${successGlow ? 'success-glow' : ''} ${leaving ? 'leaving' : ''}`}>
          <div className="verify-2fa-handle" aria-hidden="true" />

          {/*
            Três camadas empilhadas na MESMA posição (crossfade), não uma
            transição de slide: form (6 caixas) -> spinner -> sucesso.
          */}
          <div className="login-step active" id="step2fa">
            <div className={`otp-form ${!isVerifying && !isSuccess ? '' : 'otp-form-hidden'}`}>
              <span className="login-eyebrow">Verificação em duas etapas</span>
              <h1 className="login-title">Confirme seu acesso</h1>
              <p className="login-sub">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>

              <div className={`code-row ${shake ? 'shake' : ''}`} id="codeRow">
                {digits.map((digit, i) => (
                  <div
                    key={i}
                    className={`code-cell ${activeIndex === i ? 'active' : ''} ${digit ? 'filled' : ''} ${errorState ? 'error-state' : ''}`}
                  >
                    <input
                      ref={(el) => { inputRefs.current[i] = el; }}
                      className="code-input"
                      inputMode="numeric"
                      maxLength={1}
                      aria-label={`Dígito ${i + 1}`}
                      value={digit}
                      disabled={disabled}
                      onChange={(e) => handleChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={handlePaste}
                    />
                    {activeIndex === i && !digit && <span className="code-cursor" aria-hidden="true" />}
                    <svg className="cell-ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <rect x="2" y="2" width="96" height="96" rx="20" ry="20" pathLength={100} />
                    </svg>
                  </div>
                ))}
              </div>

              <p className="error-text">{errorMsg}</p>

              <button className="btn btn-primary" disabled={!allFilled || isVerifying} onClick={beginVerification}>
                Verificar
              </button>

              <div className="resend-row">
                Não recebeu?{' '}
                <button className={`link-accent ${resendSeconds === 0 ? 'activated' : ''}`} disabled={resendSeconds > 0} onClick={handleResend}>
                  {resendSeconds > 0 ? `Reenviar código (${resendSeconds}s)` : 'Reenviar código'}
                </button>
              </div>
            </div>

            <div className={`otp-verifying ${isVerifying ? 'otp-verifying-visible' : ''}`} aria-hidden={!isVerifying}>
              <div className="otp-spinner"><span /></div>
            </div>

            <div className={`otp-success ${isSuccess ? 'otp-success-visible' : ''}`} aria-hidden={!isSuccess}>
              <h1 className="login-title">Identidade verificada com sucesso.</h1>
              <p className="login-sub">Preparando seu painel...</p>
              <div className="otp-check-box">
                <svg className={`otp-check ${checkDraw ? 'otp-check-draw' : ''}`} viewBox="0 0 52 52" aria-hidden="true">
                  <path d="M14 27.5L23 36L39 17" pathLength={100} />
                </svg>
              </div>
            </div>
          </div>

        </div>
      </div>
      </main>
    </>
  );
}
