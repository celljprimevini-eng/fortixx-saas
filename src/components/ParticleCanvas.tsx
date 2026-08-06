'use client';

import { useEffect, useRef } from 'react';

/**
 * ParticleCanvas — fundo vivo com partículas sutis conectadas por linhas.
 * Plugado em RootLayout (src/app/layout.tsx), atrás de todo o conteúdo.
 *
 * Inspirado no protótipo original (fortixx-landing.html). Renderiza via
 * Canvas 2D, requestAnimationFrame, com ~70 partículas que se atraem
 * levemente e desenham uma linha entre as que estão próximas o suficiente.
 *
 * Cores: herdam dos tokens do design system (--blue-light e --gold)
 * para casar com o resto da UI.
 *
 * Respeita prefers-reduced-motion: se ativo, não anima (canvas vazio).
 */

const PARTICLE_COUNT = 70;
const MAX_DISTANCE = 130; // px — distância máxima pra desenhar linha entre duas partículas
const MAX_SPEED = 0.35; // px/frame — velocidade máxima de drift

type Particle = { x: number; y: number; vx: number; vy: number; r: number };

function readTokens() {
  if (typeof window === 'undefined') return { blue: '#5B8DEF', gold: '#FBBF24' };
  const root = getComputedStyle(document.documentElement);
  return {
    blue: root.getPropertyValue('--blue-light').trim() || '#5B8DEF',
    gold: root.getPropertyValue('--gold').trim() || '#FBBF24',
  };
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (prefersReducedMotion()) return; // canvas fica vazio (sem custo)

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let particles: Particle[] = [];
    let dpr = window.devicePixelRatio || 1;
    let w = 0;
    let h = 0;
    const tokens = readTokens();

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Repopula partículas se mudou muito de tamanho (evita ficar vazio ao rotacionar)
      if (particles.length === 0 || Math.abs(particles.length - PARTICLE_COUNT) > 10) {
        particles = Array.from({ length: PARTICLE_COUNT }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * MAX_SPEED,
          vy: (Math.random() - 0.5) * MAX_SPEED,
          r: Math.random() * 1.4 + 0.6,
        }));
      }
    }

    function step() {
      ctx!.clearRect(0, 0, w, h);

      // Move + desenha partículas
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // wrap (sai de um lado, entra do outro)
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = tokens.blue;
        ctx!.globalAlpha = 0.45;
        ctx!.fill();
      }

      // Linhas conectando partículas próximas
      ctx!.globalAlpha = 1;
      ctx!.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > MAX_DISTANCE) continue;
          const t = 1 - dist / MAX_DISTANCE;
          ctx!.strokeStyle = tokens.gold;
          ctx!.globalAlpha = t * 0.18;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }

      raf = requestAnimationFrame(step);
    }

    resize();
    raf = requestAnimationFrame(step);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="bg-canvas" aria-hidden="true" />;
}