'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Cópia de demonstração de /auth/verify SEM chamada real ao Supabase —
 * existe só pra dar pra assistir a animação inteira (digitação, fusão,
 * "Verificando/Processando/Autorizando", sucesso verde) sem precisar de
 * login nem de código real. Mesmo JSX/CSS da página de verdade, timings
 * idênticos; a única troca é verifyCode() virar um mock que sempre
 * resolve "ok" depois de um delay simulado. Roda automaticamente ao
 * abrir e tem um botão "Repetir".
 */
export default function VerifyDemoPage() {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [disabled, setDisabled] = useState(false);
  const [errorState, setErrorState] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [merging, setMerging] = useState(false);
  const [merged, setMerged] = useState(false);
  const [statusShow, setStatusShow] = useState(false);
  const [statusText, setStatusText] = useState('Verificando identidade...');
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successGlow, setSuccessGlow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pulseIndex, setPulseIndex] = useState<number | null>(null);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digitsRef = useRef(digits);
  digitsRef.current = digits;

  const allFilled = digits.every((d) => d.length === 1);

  const beginVerification = useCallback(async () => {
    if (verifying || !digitsRef.current.every((d) => d.length === 1)) return;
    setVerifying(true);
    setDisabled(true);
    setErrorState(false);
    setErrorMsg('');

    setMerging(true);

    setTimeout(() => {
      setStatusShow(true);
      setStatusText('Verificando identidade...');
    }, 900);

    setTimeout(() => setStatusText('Processando com Fortixx AI...'), 1700);
    setTimeout(() => setStatusText('Autorizando acesso...'), 2500);
    setTimeout(() => setMerged(true), 1300);

    setTimeout(() => {
      // Mock: sem rede, sempre "ok" — só pra ver a animação de sucesso.
      setStatusText('Identidade verificada com sucesso.');
      setTimeout(() => {
        setSuccess(true);
        setSuccessGlow(true);
        setTimeout(() => setLeaving(true), 1400);
      }, 300);
    }, 3200);
  }, [verifying]);

  function resetAndPlay() {
    setDigits(['', '', '', '', '', '']);
    setDisabled(false);
    setErrorState(false);
    setErrorMsg('');
    setShake(false);
    setMerging(false);
    setMerged(false);
    setStatusShow(false);
    setStatusText('Verificando identidade...');
    setVerifying(false);
    setSuccess(false);
    setSuccessGlow(false);
    setLeaving(false);
    setPulseIndex(null);

    let i = 0;
    const fake = ['4', '8', '2', '1', '9', '5'];
    const t = setInterval(() => {
      if (i >= 6) {
        clearInterval(t);
        return;
      }
      const idx = i;
      setDigits((prev) => {
        const next = [...prev];
        next[idx] = fake[idx];
        return next;
      });
      setPulseIndex(idx);
      setTimeout(() => setPulseIndex((p) => (p === idx ? null : p)), 350);
      i++;
    }, 350);
  }

  useEffect(() => {
    resetAndPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (allFilled && !verifying && !success) {
      const t = setTimeout(() => beginVerification(), 150);
      return () => clearTimeout(t);
    }
  }, [allFilled, verifying, success, beginVerification]);

  return (
    <>
      <div className="ambient" aria-hidden="true">
        <div className="orb orb-1" />
      </div>
      <main className="login-main">
        <div className="login-card-wrap">
          <div className={`login-card glass ${successGlow ? 'success-glow' : ''} ${leaving ? 'leaving' : ''}`}>
            <div className="login-step active" id="step2fa">
              <span className="login-eyebrow">Verificação em duas etapas (DEMO — sem login)</span>
              <h1 className="login-title">{success ? 'Identidade verificada com sucesso.' : 'Confirme seu acesso'}</h1>
              <p className="login-sub">
                {success
                  ? 'Preparando seu painel...'
                  : 'Digite o código de 6 dígitos do seu aplicativo autenticador.'}
              </p>

              <div className={`code-zone ${shake ? 'shake' : ''} ${merging ? 'merging' : ''} ${merged ? 'merged' : ''}`} id="codeZone">
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
                      readOnly
                    />
                  ))}
                </div>
                <div className={`merge-badge ${merged ? 'show' : ''} ${success ? 'success' : ''}`} aria-hidden="true">
                  <span className="spinner" aria-hidden="true" />
                  <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M5 13l4 4L19 7" /></svg>
                </div>
              </div>

              {!success && <p className="error-text">{errorMsg}</p>}

              {!success && (
                <div className={`verify-status-wrap ${statusShow ? 'show' : ''}`}>
                  <div className="ai-pulse-icon" aria-hidden="true"><span /><span /><span /></div>
                  <p className="verify-status-text">{statusText}</p>
                </div>
              )}
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
