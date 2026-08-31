'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reprodução visual 1:1 do vídeo de referência (tutorial "OTP Verification
 * V2"): NÃO é uma tela de autenticação, é uma demo de motion-design.
 * 6 dígitos (a contagem não muda a animação), textos em inglês, editor de
 * código fake abaixo — tudo igual ao vídeo. Loop automático, sem botão de
 * repetir. Classes CSS com prefixo demo- pra nunca colidir com as de
 * /auth/verify (página real). Ver CORRECAO_OTP_VERIFY_DEMO_CLAUDE.md.
 */
type Phase = 'idle' | 'filling' | 'verifying' | 'success';

const CODE = ['4', '8', '2', '1', '9', '5'];

export default function VerifyDemoPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [digits, setDigits] = useState<string[]>(Array(CODE.length).fill(''));
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [pulseIndex, setPulseIndex] = useState<number | null>(null);
  const [grouping, setGrouping] = useState(false);
  const [checkVisible, setCheckVisible] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const addTimer = (callback: () => void, delay: number) => {
      const timer = setTimeout(callback, delay);
      timers.current.push(timer);
    };

    const run = () => {
      setPhase('idle');
      setDigits(Array(CODE.length).fill(''));
      setActiveIndex(0);
      setPulseIndex(null);
      setGrouping(false);
      setCheckVisible(false);

      let t = 700;
      const step = 550;
      CODE.forEach((digit, i) => {
        addTimer(() => {
          setDigits((prev) => {
            const next = [...prev];
            next[i] = digit;
            return next;
          });
          setActiveIndex(i < CODE.length - 1 ? i + 1 : -1);
          setPhase('filling');
          // Traço de borda: flash rápido (aparece e some), não fica preso.
          setPulseIndex(i);
          addTimer(() => setPulseIndex((p) => (p === i ? null : p)), t + 700);
        }, t);
        t += step;
      });

      // Depois do último dígito, um LED corre ao redor da FILEIRA INTEIRA
      // antes de começar a verificação — igual ao vídeo de referência.
      addTimer(() => setGrouping(true), t + 150);
      addTimer(() => { setGrouping(false); setPhase('verifying'); setActiveIndex(-1); }, t + 750);
      addTimer(() => { setPhase('success'); }, t + 1250);
      addTimer(() => { setCheckVisible(true); }, t + 1500);
      // Loop: reinicia automaticamente depois de segurar o estado de sucesso.
      addTimer(() => { run(); }, t + 4800);
    };

    run();

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  const isSuccess = phase === 'success';
  const allFilled = digits.every((d) => d !== '');

  return (
    <main className="otp-demo">
      <div className="demo-page">
        <header className="demo-header">
          <h1>OTP Verification</h1>
          <div className="demo-version">V2</div>
        </header>

        <section
          className={['demo-card', isSuccess ? 'demo-card-success' : ''].filter(Boolean).join(' ')}
        >
          <div className="demo-handle" />

          <div className={['demo-form', isSuccess || phase === 'verifying' ? 'demo-form-hidden' : ''].filter(Boolean).join(' ')}>
            <h2>Let&apos;s verify your number</h2>

            <p className="demo-description">
              We&apos;ve sent a 6-digit code to your phone.
              <br />
              It&apos;ll auto-verify once entered.
            </p>

            <div className={`demo-inputs-wrap ${grouping ? 'grouping' : ''}`}>
              <div className="demo-inputs">
                {digits.map((digit, index) => {
                  const isActive = activeIndex === index;
                  const isFilled = digit !== '';

                  return (
                    <div
                      key={index}
                      className={['demo-input', isActive ? 'demo-input-active' : '', isFilled ? 'demo-input-filled' : '', pulseIndex === index ? 'demo-input-pulsing' : '', allFilled ? 'demo-input-complete' : '']
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {digit}
                      {isActive && <span className="demo-cursor" />}
                      <svg className="demo-ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        <rect x="2" y="2" width="96" height="96" rx="20" ry="20" pathLength={100} />
                      </svg>
                    </div>
                  );
                })}
              </div>
              <svg className="demo-group-ring" viewBox="0 0 398 81" preserveAspectRatio="none" aria-hidden="true">
                <rect x="2" y="2" width="394" height="77" rx="22" ry="22" pathLength={100} />
              </svg>
            </div>

            <div className="demo-resend">
              <span>Didn&apos;t receive the code?</span>
              <strong>Resend</strong>
            </div>
          </div>

          <div className={['demo-verifying', phase === 'verifying' ? 'demo-verifying-visible' : ''].filter(Boolean).join(' ')}>
            <div className="demo-spinner"><span /></div>
          </div>

          <div className={['demo-success', isSuccess ? 'demo-success-visible' : ''].filter(Boolean).join(' ')}>
            <div className="demo-success-content">
              <h2>Verified successfully</h2>
              <p>Your phone number has been verified.</p>
              <div className="demo-check-box">
                <svg
                  className={['demo-check', checkVisible ? 'demo-check-draw' : ''].filter(Boolean).join(' ')}
                  viewBox="0 0 52 52"
                  aria-hidden="true"
                >
                  <path d="M14 27.5L23 36L39 17" pathLength={100} />
                </svg>
              </div>
            </div>
            <div className="demo-resend demo-resend-success">
              <span>Didn&apos;t receive the code?</span>
              <strong>Resend</strong>
            </div>
          </div>
        </section>

        <CodeEditor />
      </div>
    </main>
  );
}

function CodeEditor() {
  return (
    <section className="code-editor">
      <div className="code-editor-header">
        <div className="traffic-lights">
          <span className="traffic red" />
          <span className="traffic yellow" />
          <span className="traffic green" />
        </div>

        <div className="code-editor-brand">
          codeXr
          <span>&lt;/&gt;</span>
        </div>

        <div className="code-editor-follow">Like &amp; Follow for more ❤️</div>
      </div>

      <pre className="code-content">
        <code>
          <span className="code-line"><span className="line-number">01</span> <span className="pink">import</span> {'{'} useState {'}'} <span className="pink">from</span> <span className="orange">&apos;react&apos;</span>;   <span className="green">{'// OTP Verification V2'}</span></span>
          <span className="code-line"><span className="line-number">02</span> <span className="pink">import</span> {'{'} motion {'}'} <span className="pink">from</span> <span className="orange">&apos;framer-motion&apos;</span>;</span>
          <span className="code-line"><span className="line-number">03</span></span>
          <span className="code-line"><span className="line-number">04</span> <span className="pink">export default function</span> <span className="yellow">OTPVerification</span>() {'{'}</span>
          <span className="code-line"><span className="line-number">05</span>   <span className="pink">const</span> [otp, setOtp] = useState(Array(6).fill(<span className="orange">&quot;&quot;</span>));</span>
          <span className="code-line"><span className="line-number">06</span>   <span className="pink">const</span> [isVerified, setIsVerified] = useState(<span className="blue">false</span>);</span>
          <span className="code-line"><span className="line-number">07</span></span>
          <span className="code-line"><span className="line-number">08</span>   <span className="pink">const</span> handleChange = (value, index) =&gt; {'{'}</span>
          <span className="code-line"><span className="line-number">09</span>     <span className="pink">if</span> (!/[0-9]/.test(value)) <span className="pink">return</span>;</span>
          <span className="code-line"><span className="line-number">10</span>     <span className="pink">const</span> newOtp = [...otp];</span>
          <span className="code-line"><span className="line-number">11</span>     newOtp[index] = value;</span>
          <span className="code-line"><span className="line-number">12</span>     setOtp(newOtp);</span>
          <span className="code-line"><span className="line-number">13</span>   {'}'};</span>
          <span className="code-line"><span className="line-number">14</span></span>
          <span className="code-line"><span className="line-number">15</span>   <span className="pink">const</span> handleVerify = () =&gt; {'{'}</span>
          <span className="code-line"><span className="line-number">16</span>     <span className="pink">if</span> (otp.join(<span className="orange">&quot;&quot;</span>).length === <span className="blue">6</span>) {'{'}</span>
          <span className="code-line"><span className="line-number">17</span>       setIsVerified(<span className="blue">true</span>); <span className="green">{'// Call your API here'}</span></span>
          <span className="code-line"><span className="line-number">18</span>     {'}'}</span>
          <span className="code-line"><span className="line-number">19</span>   {'}'};</span>
        </code>
      </pre>

      <div className="code-annotation">
        <svg viewBox="0 0 130 90" aria-hidden="true">
          <path d="M105 8 C70 12 48 30 35 60" />
          <path d="M35 60 L39 47" />
          <path d="M35 60 L49 58" />
        </svg>

        <div>
          <span>6-digit code</span>
          <span>verification</span>
        </div>

        <div className="annotation-underline" />
      </div>
    </section>
  );
}
