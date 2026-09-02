'use client';

import { useEffect, useState } from 'react';

/**
 * Toggle claro/escuro — o MESMO botão animado (blob deslizante + sol/lua) da
 * landing page (`.premium-toggle` no globals.css), pra ficar consistente em
 * todo o site.
 *
 * A escolha é salva em localStorage (`fortixx-theme`) e vale em todas as
 * páginas — landing, login, dashboard. O flash inicial é evitado por um
 * script inline no <head> (src/app/layout.tsx e nos route.ts da landing/
 * dashboard) que aplica o tema salvo antes da primeira pintura.
 */

const STORAGE_KEY = 'fortixx-theme';

function readStored(): 'light' | 'dark' | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const initial = readStored() ?? current;
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* modo privado / storage bloqueado — troca só nesta página, sem persistir */
    }
  }

  return (
    <button
      className={`premium-toggle ${className}`.trim()}
      data-theme={theme}
      aria-pressed={theme === 'light'}
      aria-label="Alternar tema claro e escuro"
      type="button"
      onClick={toggle}
    >
      <span className="pt-blob" />
      <span className="pt-icon pt-sun" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className="pt-icon pt-moon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
