'use client';

import { useEffect, useState } from 'react';

/**
 * Overlay de confirmação animada (check dourado + anéis pulsando).
 * Some sozinho depois de `duration` ms e chama `onDone`.
 *
 *   {ok && <ConfirmBurst title="Tudo certo!" sub="Salvando..." onDone={() => ...} />}
 *
 * A CSS mora em globals.css (.confirm-*) e é a mesma que o dashboard usa
 * via window.__fortixxConfirm().
 */
export function ConfirmBurst({
  title = 'Confirmado',
  sub,
  duration = 1600,
  onDone,
}: {
  title?: string;
  sub?: string;
  duration?: number;
  onDone?: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), duration - 250);
    const t2 = setTimeout(() => onDone?.(), duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [duration, onDone]);

  return (
    <div className={`confirm-overlay${leaving ? ' leaving' : ''}`} role="status" aria-live="polite">
      <div className="confirm-card">
        <div className="confirm-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="confirm-title">{title}</div>
        {sub && <div className="confirm-sub">{sub}</div>}
      </div>
    </div>
  );
}
