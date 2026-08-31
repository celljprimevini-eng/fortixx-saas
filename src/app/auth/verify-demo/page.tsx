'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Cópia de demonstração de /auth/verify SEM chamada real ao Supabase —
 * existe só pra dar pra assistir a animação inteira (digitação, fusão,
 * badge com anel "correndo", sucesso verde) sem precisar de login nem de
 * código real. Mesmo JSX/CSS da página de verdade, timings idênticos; a
 * única troca é o resultado da verificação virar um mock que sempre dá
 * "ok" depois de um delay curto. Roda automaticamente ao abrir e tem um
 * botão "Repetir".
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
  const frozenRef = useRef(false);

  const allFilled = digits.every((d) => d.length === 1);

  const beginVerification = useCallback(async () => {
    if (verifying || !digitsRef.current.every((d) => d.length === 1)) return;
    setVerifying(true);
    setDisabled(true);
    setErrorState(false);
    setErrorMsg('');

    setMerging(true);
    setTimeout(() => setMerged(true), 400);
    setTimeout(() => {
      setStatusShow(true);
      setStatusText('Verificando identidade...');
    }, 420);

    // Mock: sem rede, delay curto simulando a resposta real (igual ao
    // vídeo de referência, onde a fusão inteira até "verificado" leva
    // menos de 1s no total).
    setTimeout(() => {
      setStatusText('Identidade verificada com sucesso.');
      setSuccess(true);
      setSuccessGlow(true);
      setTimeout(() => setLeaving(true), 900);
    }, 900);
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
    // ?freeze=merged|success trava num estado fixo (sem os timers da
    // sequência real) só pra dar pra inspecionar/printar sem correr
    // contra o relógio. Sem o parâmetro, roda a sequência normal.
    const freeze = new URLSearchParams(window.location.search).get('freeze');
    if (freeze === 'merging' || freeze === 'merged' || freeze === 'success') {
      frozenRef.current = true;
      setDigits(['4', '8', '2', '1', '9', '5']);
      setDisabled(true);
      setMerging(true);
      if (freeze === 'merged' || freeze === 'success') {
        setMerged(true);
        setStatusShow(true);
      }
      if (freeze === 'success') {
        setStatusText('Identidade verificada com sucesso.');
        setSuccess(true);
        setSuccessGlow(true);
      }
      return;
    }
    resetAndPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (frozenRef.current) return;
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
                    <div key={i} className={`code-cell ${digit ? 'filled' : ''}`}>
                      <input
                        ref={(el) => { inputRefs.current[i] = el; }}
                        className={`code-input ${pulseIndex === i ? 'filled-pulse' : ''} ${errorState ? 'error-state' : ''}`}
                        inputMode="numeric"
                        maxLength={1}
                        aria-label={`Dígito ${i + 1}`}
                        value={digit}
                        disabled={disabled}
                        readOnly
                      />
                      <svg className="cell-ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        <rect x="2" y="2" width="96" height="96" rx="18" ry="18" pathLength={100} />
                      </svg>
                    </div>
                  ))}
                </div>
                <div className={`merge-badge ${merged ? 'show' : ''} ${success ? 'success' : ''}`} aria-hidden="true">
                  <svg className="merge-ring" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                    <rect x="1.5" y="1.5" width="97" height="37" rx="10" ry="10" pathLength={100} />
                  </svg>
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
