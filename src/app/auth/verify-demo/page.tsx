'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Cópia de demonstração de /auth/verify SEM chamada real ao Supabase —
 * existe só pra dar pra assistir a animação inteira sem precisar de login
 * nem de código real. Mesmo JSX/CSS da página de verdade (camadas
 * empilhadas: form -> spinner -> sucesso, crossfade, não slide); a única
 * troca é o resultado da verificação virar um mock que sempre dá "ok"
 * depois de um delay curto. Roda automaticamente ao abrir e tem um botão
 * "Repetir". Aceita ?freeze=verifying|success pra travar num estado fixo
 * sem correr contra os timers (útil pra inspecionar/printar).
 */
type Phase = 'idle' | 'verifying' | 'success';

export default function VerifyDemoPage() {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [phase, setPhase] = useState<Phase>('idle');
  const [checkDraw, setCheckDraw] = useState(false);
  const [successGlow, setSuccessGlow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [frozen, setFrozen] = useState(false);

  const allFilled = digits.every((d) => d.length === 1);

  const beginVerification = useCallback(() => {
    setPhase('verifying');
    setTimeout(() => {
      setPhase('success');
      setSuccessGlow(true);
      setTimeout(() => setCheckDraw(true), 120);
      setTimeout(() => setLeaving(true), 1600);
    }, 900);
  }, []);

  function resetAndPlay() {
    setDigits(['', '', '', '', '', '']);
    setPhase('idle');
    setCheckDraw(false);
    setSuccessGlow(false);
    setLeaving(false);
    setActiveIndex(0);

    let i = 0;
    const fake = ['4', '8', '2', '1', '9', '5'];
    const t = setInterval(() => {
      if (i >= 6) {
        clearInterval(t);
        setActiveIndex(-1);
        return;
      }
      const idx = i;
      setDigits((prev) => {
        const next = [...prev];
        next[idx] = fake[idx];
        return next;
      });
      setActiveIndex(idx + 1 <= 5 ? idx + 1 : -1);
      i++;
    }, 350);
  }

  useEffect(() => {
    const freeze = new URLSearchParams(window.location.search).get('freeze');
    if (freeze === 'verifying' || freeze === 'success') {
      setFrozen(true);
      setDigits(['4', '8', '2', '1', '9', '5']);
      setActiveIndex(-1);
      setPhase(freeze === 'verifying' ? 'verifying' : 'success');
      if (freeze === 'success') {
        setSuccessGlow(true);
        setCheckDraw(true);
      }
      return;
    }
    resetAndPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (frozen) return;
    if (allFilled && phase === 'idle') {
      const t = setTimeout(() => beginVerification(), 150);
      return () => clearTimeout(t);
    }
  }, [allFilled, phase, frozen, beginVerification]);

  const isVerifying = phase === 'verifying';
  const isSuccess = phase === 'success';

  return (
    <>
      <div className="ambient" aria-hidden="true">
        <div className="orb orb-1" />
      </div>
      <main className="login-main">
        <div className="login-card-wrap">
          <div className={`login-card glass ${successGlow ? 'success-glow' : ''} ${leaving ? 'leaving' : ''}`}>
            <div className="login-step active" id="step2fa">
              <div className={`otp-form ${!isVerifying && !isSuccess ? '' : 'otp-form-hidden'}`}>
                <span className="login-eyebrow">Verificação em duas etapas (DEMO — sem login)</span>
                <h1 className="login-title">Confirme seu acesso</h1>
                <p className="login-sub">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>

                <div className="code-row" id="codeRow">
                  {digits.map((digit, i) => (
                    <div key={i} className={`code-cell ${activeIndex === i ? 'active' : ''} ${digit ? 'filled' : ''}`}>
                      <input
                        className="code-input"
                        inputMode="numeric"
                        maxLength={1}
                        aria-label={`Dígito ${i + 1}`}
                        value={digit}
                        readOnly
                      />
                      {activeIndex === i && !digit && <span className="code-cursor" aria-hidden="true" />}
                    </div>
                  ))}
                </div>

                <p className="error-text" />
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
