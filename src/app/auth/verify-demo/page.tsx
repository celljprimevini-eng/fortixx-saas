'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Cópia de demonstração de /auth/verify SEM chamada real ao Supabase —
 * existe só pra dar pra assistir a animação inteira sem precisar de login
 * nem de código real. Mesma estrutura/marca da página real (português,
 * Fortixx) — não é mais uma reprodução literal do vídeo tutorial em
 * inglês. Roda automaticamente ao abrir e tem um botão "Repetir".
 */
export default function VerifyDemoPage() {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [disabled, setDisabled] = useState(false);
  const [errorState, setErrorState] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'verifying' | 'success'>('idle');
  const [checkDraw, setCheckDraw] = useState(false);
  const [successGlow, setSuccessGlow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pulseIndex, setPulseIndex] = useState<number | null>(null);
  const [grouping, setGrouping] = useState(false);
  const [frozen, setFrozen] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const allFilled = digits.every((d) => d.length === 1);

  const beginVerification = useCallback(() => {
    if (phase !== 'idle' || !allFilled) return;
    setDisabled(true);
    setPhase('verifying');

    // Mock: sem rede, sempre "ok" depois de um delay curto.
    const t = setTimeout(() => {
      setPhase('success');
      setSuccessGlow(true);
      timers.current.push(setTimeout(() => setCheckDraw(true), 120));
    }, 900);
    timers.current.push(t);
  }, [phase, allFilled]);

  function resetAndPlay() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFrozen(false);
    setDigits(['', '', '', '', '', '']);
    setDisabled(false);
    setErrorState(false);
    setErrorMsg('');
    setShake(false);
    setPhase('idle');
    setCheckDraw(false);
    setSuccessGlow(false);
    setLeaving(false);
    setActiveIndex(0);
    setPulseIndex(null);
    setGrouping(false);

    const addTimer = (cb: () => void, delay: number) => timers.current.push(setTimeout(cb, delay));
    const fake = ['4', '8', '2', '1', '9', '5'];
    let t = 500;
    fake.forEach((digit, i) => {
      addTimer(() => {
        setDigits((prev) => {
          const next = [...prev];
          next[i] = digit;
          return next;
        });
        setActiveIndex(i < 5 ? i + 1 : -1);
        setPulseIndex(i);
        addTimer(() => setPulseIndex((p) => (p === i ? null : p)), 1100);
      }, t);
      t += 750;
    });

    addTimer(() => setGrouping(true), t + 250);
    addTimer(() => {
      setGrouping(false);
      setDisabled(true);
      setPhase('verifying');
    }, t + 1150);
    addTimer(() => {
      setPhase('success');
      setSuccessGlow(true);
      addTimer(() => setCheckDraw(true), 120);
    }, t + 2050);
    addTimer(() => {
      setLeaving(true);
    }, t + 3650);
    // Loop: reinicia automaticamente depois de segurar o estado de sucesso.
    addTimer(() => resetAndPlay(), t + 4200);
  }

  useEffect(() => {
    const freeze = new URLSearchParams(window.location.search).get('freeze');
    if (freeze === 'verifying' || freeze === 'success') {
      setFrozen(true);
      setDigits(['4', '8', '2', '1', '9', '5']);
      setDisabled(true);
      setActiveIndex(-1);
      setPhase(freeze === 'verifying' ? 'verifying' : 'success');
      if (freeze === 'success') {
        setSuccessGlow(true);
        setCheckDraw(true);
      }
      return;
    }
    resetAndPlay();
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(index: number, value: string) {
    const clean = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean) {
      setPulseIndex(index);
      setTimeout(() => setPulseIndex((p) => (p === index ? null : p)), 1100);
      const nextIndex = index < 5 ? index + 1 : -1;
      setActiveIndex(nextIndex);
      if (nextIndex >= 0) inputRefs.current[nextIndex]?.focus();
    } else {
      setActiveIndex(index);
    }
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

            <div className="login-step active" id="step2fa">
              <div className={`otp-form ${!isVerifying && !isSuccess ? '' : 'otp-form-hidden'}`}>
                <span className="login-eyebrow">Verificação em duas etapas (DEMO — sem login)</span>
                <h1 className="login-title">Confirme seu acesso</h1>
                <p className="login-sub">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>

                <div className={`code-row-wrap ${grouping ? 'grouping' : ''}`}>
                  <div className={`code-row ${shake ? 'shake' : ''}`} id="codeRow">
                    {digits.map((digit, i) => (
                      <div
                        key={i}
                        className={`code-cell ${activeIndex === i ? 'active' : ''} ${digit ? 'filled' : ''} ${pulseIndex === i ? 'pulsing' : ''} ${errorState ? 'error-state' : ''}`}
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
                          readOnly={!frozen}
                        />
                        {activeIndex === i && !digit && <span className="code-cursor" aria-hidden="true" />}
                        <svg className="cell-ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                          <rect x="2" y="2" width="96" height="96" rx="20" ry="20" pathLength={100} />
                        </svg>
                      </div>
                    ))}
                  </div>
                  <svg className="group-ring" viewBox="0 0 330 72" preserveAspectRatio="none" aria-hidden="true">
                    <rect x="2" y="2" width="326" height="68" rx="20" ry="20" pathLength={100} />
                  </svg>
                </div>

                <p className="error-text">{errorMsg}</p>

                <button className="btn btn-primary" disabled={!allFilled || isVerifying} onClick={beginVerification}>
                  Verificar
                </button>

                <div className="resend-row">
                  Não recebeu?{' '}
                  <button className="link-accent" disabled>
                    Reenviar código (30s)
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
      <button
        onClick={resetAndPlay}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          padding: '10px 18px',
          borderRadius: 8,
          background: '#5B8DEF',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
          zIndex: 999,
        }}
      >
        Repetir animação
      </button>
    </>
  );
}
