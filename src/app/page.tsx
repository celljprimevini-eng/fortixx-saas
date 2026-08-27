'use client';

import { useEffect, useRef, useState } from 'react';

const STORY_STAGES = [
  { id: 'dash', title: 'Dashboard Unificado', caption: 'Visão 360º do seu RH, em tempo real' },
  { id: 'recruit', title: 'Recrutamento Inteligente', caption: 'Triagem IA em segundos, não em dias' },
  { id: 'onb', title: 'Onboarding sem Atrito', caption: 'Documentos, contratos e benefícios — sem papel' },
  { id: 'portal', title: 'Portal do Colaborador', caption: 'Autoatendimento 24/7 — seu time de RH livre pro que importa' },
  { id: 'ia', title: 'IA de Documentos', caption: 'RG, CPF e comprovantes lidos automaticamente' },
] as const;

const PROBLEMS = [
  { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Tudo espalhado', desc: 'Planilhas, e-mails e WhatsApp. Você perde horas buscando dados.' },
  { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', title: 'Triagem manual', desc: 'Currículos chegam em massa e a triagem vira gargalo.' },
  { icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', title: 'Onboarding lento', desc: 'Documentos se perdem, prazos se arrastam, novos contratados ficam no limbo.' },
  { icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', title: 'Dúvidas infinitas', desc: 'Colaboradores lotam o RH no WhatsApp perguntando a mesma coisa.' },
  { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', title: 'Sem dados reais', desc: 'Relatórios manuais, decisões no escuro. Sem saber pra onde o RH está indo.' },
];

const FEATURES = [
  { gold: false, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', title: 'Recrutamento IA', desc: 'Currículos parseados automaticamente. A IA ranqueia e classifica por compatibilidade.' },
  { gold: false, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', title: 'Admissão Digital', desc: 'eSocial, FGTS, contratos — tudo integrado. Admissão em horas, não semanas.' },
  { gold: true, icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', title: 'IA de Documentos', desc: 'RG, CPF, comprovantes — a IA lê, valida e preenche o cadastro. Zero digitação.' },
  { gold: false, icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', title: 'Portal do Colaborador', desc: 'Autoatendimento 24/7. Holerite, férias, benefícios — tudo na mão do time.' },
  { gold: true, icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', title: '2FA Obrigatório', desc: 'TOTP nativo via Supabase MFA. Cada login, uma camada extra de proteção.' },
  { gold: false, icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', title: 'Analytics Tempo Real', desc: 'Headcount, turnover, tempo de contratação. Tudo em dashboards ao vivo.' },
];

const TESTIMONIALS = [
  { result: '↓ 67% tempo de contratação', quote: 'A IA do Fortixx reduziu nossa triagem de 5 dias pra 30 minutos. Os recrutadores focam no que importa: gente.', name: 'Camila Veras', role: 'Head de Pessoas · Vértice Tech', initials: 'CV', color: 'linear-gradient(135deg,#2563EB,#5B8DEF)' },
  { result: 'R$ 48k economizados / ano', quote: 'Trocamos 4 ferramentas pelo Fortixx. Onboarding digital + portal responderam por quase todo o ganho.', name: 'Rafael Menezes', role: 'CFO · Pulso Logística', initials: 'RM', color: 'linear-gradient(135deg,#FBBF24,#F59E0B)' },
  { result: '94% aprovação interna', quote: 'Os colaboradores amaram o portal. Caiu o volume de "posso falar com o RH" no WhatsApp em quase 90%.', name: 'Juliana Saito', role: 'Gerente de RH · Bamboo Saúde', initials: 'JS', color: 'linear-gradient(135deg,#34D399,#10B981)' },
];

const PLANS: Array<{
  id: string; name: string; desc: string;
  monthly?: number; yearly?: number; oldMonthly?: number;
  custom?: boolean; popular?: boolean;
  features: string[];
}> = [
  { id: 'starter', name: 'Essencial', desc: 'Pra times pequenos que querem parar com planilha.', monthly: 419.30, yearly: 4190, oldMonthly: 499, features: ['Até 25 colaboradores', 'Recrutamento com IA', 'Onboarding digital', 'Portal do colaborador', 'Suporte por e-mail'] },
  { id: 'pro', name: 'Profissional', desc: 'Times em crescimento que precisam escalar sem fricção.', monthly: 1049.30, yearly: 10490, oldMonthly: 1299, popular: true, features: ['Até 200 colaboradores', 'IA de documentos', '2FA obrigatório', 'Analytics avançado', 'Suporte prioritário', 'Integração eSocial'] },
  { id: 'ent', name: 'Enterprise', desc: 'Solução sob medida para grandes operações.', custom: true, features: ['Colaboradores ilimitados', 'SSO / SAML', 'API dedicada', 'Gerente de sucesso', 'SLA 99.9%', 'Onboarding assistido'] },
];

const FAQS = [
  { tag: 'Implantação', q: 'Em quanto tempo o Fortixx fica pronto pra usar?', a: 'Em média, 7 dias úteis. A gente cuida da importação dos colaboradores atuais, configura autenticação, conecta ao eSocial e treina sua equipe. Você só precisa decidir quem é o admin.' },
  { tag: 'Segurança', q: 'Como funciona a proteção de dados (LGPD)?', a: 'Tudo hospedado no Supabase (Postgres com criptografia em repouso), RLS nativo por tenant, 2FA obrigatório para admins e criptografia em trânsito via TLS 1.3. Somos empresa brasileira, dados ficam no Brasil.' },
  { tag: 'IA', q: 'A IA lê documentos mesmo? Tem risco de erro?', a: 'Sim — RG, CPF, comprovantes de residência e renda são lidos por OCR + LLM. Cada campo extraído tem confiança exposta no app. Abaixo de 90%, a IA pede confirmação humana antes de salvar.' },
  { tag: 'Integrações', q: 'Integra com meu eSocial, folha e ERP atual?', a: 'Hoje temos integração nativa com eSocial (envio de eventos S-1000, S-2200, S-2300) e via webhook com qualquer folha. Para ERPs específicos, usamos API REST documentada — em média, 2 dias de setup.' },
  { tag: 'Custos', q: 'Posso cancelar quando quiser? Tem multa?', a: 'Sem multa. Assinatura mensal pode ser cancelada a qualquer momento com 30 dias de aviso. Plano anual tem 20% de desconto e, se não fizer sentido nos primeiros 30 dias, devolvemos o valor integral.' },
];

export default function LandingPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlan, setModalPlan] = useState('');
  const [modalStep, setModalStep] = useState(1);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeStory, setActiveStory] = useState(0);

  const canvasFrontRef = useRef<HTMLCanvasElement | null>(null);
  const canvasBackRef = useRef<HTMLCanvasElement | null>(null);
  const dashWrapRef = useRef<HTMLDivElement | null>(null);
  const heroContentRef = useRef<HTMLDivElement | null>(null);
  const heroGridRef = useRef<HTMLDivElement | null>(null);
  const storyRef = useRef<HTMLDivElement | null>(null);
  const navBgRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const iaFrameRef = useRef<HTMLDivElement | null>(null);
  const iaScanRef = useRef<HTMLDivElement | null>(null);
  const iaFieldsRef = useRef<HTMLDivElement | null>(null);
  const iaBadgeRef = useRef<HTMLDivElement | null>(null);
  const iaSavedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
      if (progressRef.current) progressRef.current.style.width = pct + '%';
      if (navBgRef.current) navBgRef.current.classList.toggle('scrolled', h.scrollTop > 24);
      setStickyVisible(h.scrollTop > 520);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 12;
      const y = (e.clientY / window.innerHeight - 0.5) * 12;
      if (heroGridRef.current) heroGridRef.current.style.transform = `translate(${x * -0.5}px, ${y * -0.5}px)`;
      if (heroContentRef.current) heroContentRef.current.style.transform = `translate(${x * 0.4}px, ${y * 0.4}px)`;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const el = dashWrapRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width - 0.5) * 8;
      const py = ((e.clientY - r.top) / r.height - 0.5) * -6;
      el.style.transform = `perspective(1400px) rotateY(${px}deg) rotateX(${py}deg)`;
    };
    const onLeave = () => { el.style.transform = ''; };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const isMobile = window.innerWidth < 768;
    const setup = (canvas: HTMLCanvasElement, count: number, speed: number, sizeMin: number, sizeMax: number, opacity: number) => {
      const ctx = canvas.getContext('2d')!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const resize = () => {
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
      };
      resize();
      window.addEventListener('resize', resize);
      const particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        r: sizeMin + Math.random() * (sizeMax - sizeMin),
      }));
      let raf = 0;
      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particles) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * dpr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(140,180,255,${opacity})`;
          ctx.fill();
        }
        raf = requestAnimationFrame(draw);
      };
      draw();
      return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
    };
    const cleanupF = canvasFrontRef.current ? setup(canvasFrontRef.current, isMobile ? 32 : 65, 0.6, 0.6, 2.2, 0.55) : undefined;
    const cleanupB = canvasBackRef.current ? setup(canvasBackRef.current, isMobile ? 14 : 26, 0.35, 1.0, 3.0, 0.32) : undefined;
    return () => { cleanupF?.(); cleanupB?.(); };
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const bars = document.querySelector('.bars');
    if (!bars) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { bars.classList.add('in-view'); io.unobserve(bars); }
      });
    }, { threshold: 0.4 });
    io.observe(bars);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const sec = storyRef.current;
    if (!sec) return;
    const onScroll = () => {
      const rect = sec.getBoundingClientRect();
      const total = sec.offsetHeight - window.innerHeight;
      const passed = Math.min(Math.max(-rect.top, 0), total);
      const ratio = passed / total;
      const idx = Math.min(STORY_STAGES.length - 1, Math.floor(ratio * STORY_STAGES.length));
      setActiveStory(idx);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const frame = iaFrameRef.current;
    const scan = iaScanRef.current;
    const fields = iaFieldsRef.current;
    const badge = iaBadgeRef.current;
    const saved = iaSavedRef.current;
    if (!frame || !scan || !fields || !badge || !saved) return;
    const runSequence = () => {
      frame.classList.remove('corrected');
      scan.classList.remove('run');
      fields.classList.remove('show');
      badge.classList.remove('show');
      saved.classList.remove('show');
      setTimeout(() => scan.classList.add('run'), 80);
      setTimeout(() => frame.classList.add('corrected'), 900);
      setTimeout(() => fields.classList.add('show'), 1500);
      setTimeout(() => badge.classList.add('show'), 2200);
      setTimeout(() => saved.classList.add('show'), 2900);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { runSequence(); io.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    io.observe(frame);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const magnetic = document.querySelectorAll<HTMLElement>('.btn-magnetic');
    const cleanups: Array<() => void> = [];
    magnetic.forEach((btn) => {
      const onMove = (e: MouseEvent) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        btn.style.transform = `translate(${x * 0.18}px, ${y * 0.22}px)`;
      };
      const onLeave = () => { btn.style.transform = ''; };
      btn.addEventListener('mousemove', onMove);
      btn.addEventListener('mouseleave', onLeave);
      cleanups.push(() => { btn.removeEventListener('mousemove', onMove); btn.removeEventListener('mouseleave', onLeave); });
    });
    document.querySelectorAll<HTMLElement>('.btn-primary, .btn-gold, .btn-ghost').forEach((btn) => {
      const onClick = (e: MouseEvent) => {
        const r = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        const size = Math.max(r.width, r.height);
        ripple.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,.35);transform:scale(0);animation:ripple .55s ease-out;pointer-events:none;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px;width:${size}px;height:${size}px;`;
        btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
      };
      btn.addEventListener('click', onClick);
      cleanups.push(() => btn.removeEventListener('click', onClick));
    });
    if (!document.getElementById('ripple-kf')) {
      const s = document.createElement('style');
      s.id = 'ripple-kf';
      s.textContent = '@keyframes ripple{to{transform:scale(2.4);opacity:0;}}';
      document.head.appendChild(s);
    }
    return () => cleanups.forEach((fn) => fn());
  }, []);

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>('.price-card');
    const cleanups: Array<() => void> = [];
    cards.forEach((card) => {
      const onMove = (e: MouseEvent) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      };
      card.addEventListener('mousemove', onMove);
      cleanups.push(() => card.removeEventListener('mousemove', onMove));
    });
    return () => cleanups.forEach((fn) => fn());
  }, []);

  const openModal = (plan: string) => {
    setModalPlan(plan);
    setModalStep(1);
    setModalOpen(true);
    document.body.style.overflow = 'hidden';
  };
  const closeModal = () => {
    setModalOpen(false);
    document.body.style.overflow = '';
  };

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id="liquidDistort">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="22" />
          </filter>
        </defs>
      </svg>

      <div className="hero-canvas">
        <canvas ref={canvasBackRef} style={{ position: 'absolute', inset: 0 }} />
      </div>
      <canvas ref={canvasFrontRef} className="hero-canvas" />
      <div className="hero-light-sweep" />
      <div className="edge-lines left" />
      <div className="edge-lines right" />

      <div ref={progressRef} className="scroll-progress" />
      <div ref={navBgRef} className="nav-inner-bg" />

      <nav className="nav">
        <a href="#" className="logo">
          <span className="logo-badge">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4 L20 4 L20 9 L12 9 L12 15 L20 15 L20 20 L4 20 Z" fill="currentColor" />
            </svg>
          </span>
          <span style={{ marginLeft: 8 }}>Fortixx</span>
        </a>
        <div className="nav-links">
          <a href="#recursos">Recursos</a>
          <a href="#historia">Como funciona</a>
          <a href="#preços">Preços</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-right">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Alternar tema"
            aria-pressed={theme === 'light'}
            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, width: 38, height: 38, cursor: 'pointer', color: 'var(--text-2)', display: 'grid', placeItems: 'center' }}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
            )}
          </button>
          <a href="/login" className="nav-enter">Entrar</a>
          <button onClick={() => openModal('Demonstração')} className="btn btn-gold btn-sm">Solicitar Demo</button>
          <button className="burger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
        </div>
      </nav>
      <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
        <a href="#recursos" onClick={() => setMobileOpen(false)}>Recursos</a>
        <a href="#historia" onClick={() => setMobileOpen(false)}>Como funciona</a>
        <a href="#preços" onClick={() => setMobileOpen(false)}>Preços</a>
        <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
        <a href="/login" onClick={() => setMobileOpen(false)}>Entrar</a>
      </div>

      <header className="hero">
        <div ref={heroGridRef} className="hero-grid" />
        <div className="wrap">
          <div ref={heroContentRef} className="hero-content">
            <span className="eyebrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5" /></svg>
              100% em nuvem · pronto em 7 dias
            </span>
            <h1 className="hero-title">
              RH sem fricção.<br />
              <span className="accent">Tudo num só lugar.</span>
            </h1>
            <p className="hero-sub">
              Recrutamento com IA, admissão digital, portal do colaborador e analytics — numa plataforma multi-tenant pensada pra times brasileiros que não têm tempo a perder.
            </p>
            <div className="hero-ctas">
              <button onClick={() => openModal('Demonstração')} className="btn btn-gold btn-primary btn-magnetic">Solicitar Demonstração</button>
              <a href="#preços" className="btn btn-ghost btn-magnetic">Ver planos</a>
            </div>
            <div className="hero-trust">
              <span><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" /></svg>4.9 / 5 em satisfação</span>
              <span>· LGPD compliant · ISO-ready</span>
            </div>
          </div>
          <div ref={dashWrapRef} className="hero-dash-wrap">
            <div className="hero-dash">
              <div className="dash-topbar">
                <div className="dash-dots"><span /><span /><span /></div>
                <div className="dash-url">app.fortixx.com.br / dashboard</div>
              </div>
              <div className="dash-body">
                <div className="dash-stats">
                  <div className="dash-stat"><div className="dash-stat-label">Colaboradores</div><div className="dash-stat-value">248</div><div className="dash-stat-delta">+12 esse mês</div></div>
                  <div className="dash-stat"><div className="dash-stat-label">Vagas abertas</div><div className="dash-stat-value">18</div><div className="dash-stat-delta">+3</div></div>
                  <div className="dash-stat"><div className="dash-stat-label">Em onboarding</div><div className="dash-stat-value">7</div><div className="dash-stat-delta">2 hoje</div></div>
                </div>
                <div className="dash-main">
                  <div className="dash-chart-card">
                    <div className="dash-chart-title">Contratações · últimos 6 meses</div>
                    <div className="bars">
                      {Array.from({ length: 8 }, (_, i) => (
                        <span key={i} style={{ height: `${30 + ((i * 13) % 60)}%` }} />
                      ))}
                    </div>
                  </div>
                  <div className="dash-feed-card">
                    <div className="dash-feed-title">Atividade recente</div>
                    <div className="feed-item"><div className="feed-dot" /><div><strong>Ana Lima</strong> terminou onboarding</div></div>
                    <div className="feed-item"><div className="feed-dot" /><div>3 currículos triados pela IA</div></div>
                    <div className="feed-item"><div className="feed-dot" /><div><strong>Pedro</strong> assinou contrato</div></div>
                    <div className="feed-item"><div className="feed-dot" /><div>eSocial: 12 eventos enviados</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow reveal">O dia a dia do RH</span>
            <h2 className="section-title reveal reveal-delay-1">Se você se reconhece em alguma dessas, a gente resolve.</h2>
            <p className="section-sub reveal reveal-delay-2">Planilhas, e-mails perdidos, triagem no escuro, WhatsApp lotado. Antes do Fortixx, era assim pra 9 em cada 10 times de RH.</p>
          </div>
          <div className="problems-grid">
            {PROBLEMS.map((p, i) => (
              <div key={p.title} className="problem-card reveal" style={{ transitionDelay: `${0.1 * i}s` }}>
                <div className="problem-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={p.icon} /></svg></div>
                <div className="problem-title">{p.title}</div>
                <p className="problem-desc">{p.desc}</p>
              </div>
            ))}
          </div>
          <p className="problems-note reveal">Tudo isso <span>num único produto.</span></p>
        </div>
      </section>

      <section ref={storyRef} id="historia" className="story">
        <div className="story-sticky">
          <div className="story-intro">
            <span className="eyebrow reveal">Como funciona</span>
            <h2 className="section-title reveal reveal-delay-1">Do anúncio da vaga ao colaborador ativo.</h2>
          </div>
          <div className="story-progress">
            {STORY_STAGES.map((_, i) => (
              <div key={i} className={`story-dot ${i === activeStory ? 'active' : ''}`} />
            ))}
          </div>
          {STORY_STAGES.map((stage, i) => (
            <div key={stage.id} className="story-stage" style={{
              opacity: i === activeStory ? 1 : 0,
              transform: `translateY(${i === activeStory ? 0 : 30}px)`,
              transition: 'opacity .5s var(--ease), transform .5s var(--ease)',
            }}>
              <div className="story-stage-inner">
                <div className="story-card">
                  <div className="story-card-body">
                    {stage.id === 'dash' && (
                      <div>
                        <div className="dash-stats dashtab-grid" style={{ marginBottom: 18 }}>
                          <div className="dash-stat"><div className="dash-stat-label">Headcount</div><div className="dash-stat-value">248</div><div className="dash-stat-delta">+12</div></div>
                          <div className="dash-stat"><div className="dash-stat-label">Turnover</div><div className="dash-stat-value">3.4%</div><div className="dash-stat-delta">-1.1pp</div></div>
                          <div className="dash-stat"><div className="dash-stat-label">eSocial</div><div className="dash-stat-value">100%</div><div className="dash-stat-delta">em dia</div></div>
                          <div className="dash-stat"><div className="dash-stat-label">NPS interno</div><div className="dash-stat-value">72</div><div className="dash-stat-delta">+8</div></div>
                        </div>
                        <div className="dash-chart-title">Contratações por mês</div>
                        <div className="bars in-view">
                          {Array.from({ length: 12 }, (_, k) => (
                            <span key={k} style={{ height: `${35 + ((k * 11) % 55)}%` }} />
                          ))}
                        </div>
                      </div>
                    )}
                    {stage.id === 'recruit' && (
                      <div className="kanban">
                        {[
                          { name: 'Triagem IA', items: [['Ana Lima', '92%'], ['Pedro R.', '88%'], ['Carla M.', '85%']] },
                          { name: 'Entrevista RH', items: [['João S.', '84%']] },
                          { name: 'Teste técnico', items: [['Marina P.', '80%']] },
                          { name: 'Aprovados', items: [['Lucas T.', '95%'], ['Bia O.', '93%']] },
                        ].map((col) => (
                          <div key={col.name}>
                            <div className="kanban-col-title">{col.name}</div>
                            {col.items.map((it) => (
                              <div key={it[0]} className="kanban-card">
                                <strong>{it[0]}</strong>
                                Compatibilidade IA
                                <div className="kanban-tag">{it[1]}</div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    {stage.id === 'onb' && (
                      <div>
                        <div className="onb-stepper">
                          <div className="onb-step">1 · Cadastro</div>
                          <div className="onb-step active">2 · Documentos</div>
                          <div className="onb-step">3 · Benefícios</div>
                          <div className="onb-step">4 · Boas-vindas</div>
                        </div>
                        <div className="onb-progress"><span /></div>
                        <div className="onb-item done"><div className="onb-check"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg></div><span className="label">RG enviado</span></div>
                        <div className="onb-item done"><div className="onb-check"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg></div><span className="label">CPF validado</span></div>
                        <div className="onb-item done"><div className="onb-check"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg></div><span className="label">Comprovante de residência</span></div>
                        <div className="onb-item"><div className="onb-check" /><span className="label">Escolher plano de saúde</span></div>
                      </div>
                    )}
                    {stage.id === 'portal' && (
                      <div className="portal-grid">
                        <div className="portal-card">
                          <h4>Meus documentos</h4>
                          <div className="portal-row"><span>Holerite · jun/26</span><span className="status-pill ok">Disponível</span></div>
                          <div className="portal-row"><span>Informe de rendimentos</span><span className="status-pill ok">Disponível</span></div>
                          <div className="portal-row"><span>Contrato assinado</span><span className="status-pill ok">Disponível</span></div>
                          <div className="portal-row"><span>Férias · solicitar</span><span className="status-pill pending">Em análise</span></div>
                        </div>
                        <div className="portal-card">
                          <h4>Atendimento IA</h4>
                          <div style={{ fontSize: '0.84rem', padding: 10, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 8 }}>
                            <strong style={{ color: 'var(--blue-light)' }}>Você</strong><br />Quando posso tirar férias?
                          </div>
                          <div style={{ fontSize: '0.84rem', padding: 10, borderRadius: 10, background: 'var(--blue)', color: '#fff', marginBottom: 8 }}>
                            Faltam 8 meses para o seu período aquisitivo. Você pode antecipar 15 dias a partir de outubro. Quer que eu simule?
                          </div>
                          <div style={{ fontSize: '0.84rem', padding: 10, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            <strong style={{ color: 'var(--blue-light)' }}>Você</strong><br />Sim, por favor!
                          </div>
                        </div>
                      </div>
                    )}
                    {stage.id === 'ia' && (
                      <div className="story-doc-row">
                        <div ref={iaFrameRef} className="ia-doc-frame">
                          <div className="doc-photo" />
                          <div className="doc-line" style={{ top: 80 }} />
                          <div className="doc-line" style={{ top: 100, width: '60%' }} />
                          <div className="doc-line" style={{ top: 130 }} />
                          <div className="doc-line" style={{ top: 150, width: '70%' }} />
                          <div className="doc-line" style={{ top: 180, width: '40%' }} />
                          <div className="doc-line" style={{ top: 210, width: '55%' }} />
                          <div ref={iaScanRef} className="ia-scan-line" />
                        </div>
                        <div>
                          <div ref={iaFieldsRef} className="ia-fields">
                            <div className="ia-field-row"><span style={{ color: 'var(--text-3)' }}>Nome</span><span>Marina Pereira</span></div>
                            <div className="ia-field-row"><span style={{ color: 'var(--text-3)' }}>CPF</span><span>•••.•••.•••-44</span></div>
                            <div className="ia-field-row"><span style={{ color: 'var(--text-3)' }}>RG</span><span>••.•••.•••</span></div>
                            <div className="ia-field-row"><span style={{ color: 'var(--text-3)' }}>Nascimento</span><span>14/03/1994</span></div>
                          </div>
                          <div ref={iaBadgeRef} className="ia-badge-classify" style={{ marginTop: 18 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5" /></svg>
                            Classificado: RG · confiança 96%
                          </div>
                          <div ref={iaSavedRef} className="ia-saved-check" style={{ marginTop: 14 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
                            Salvo no cadastro em 0.8s
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="recursos" className="section" style={{ paddingTop: 160 }}>
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow reveal">Recursos</span>
            <h2 className="section-title reveal reveal-delay-1">Tudo o que seu RH precisa. Nada do que não precisa.</h2>
            <p className="section-sub reveal reveal-delay-2">Cada recurso foi pensado pra tirar trabalho da equipe, não pra somar mais uma tela pra aprender.</p>
          </div>
          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`feature-card tilt-card reveal ${f.gold ? 'gold' : ''}`} style={{ transitionDelay: `${0.08 * i}s` }}>
                <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={f.icon} /></svg></div>
                <div className="feature-title">{f.title}</div>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow reveal">Quem usa</span>
            <h2 className="section-title reveal reveal-delay-1">Times que trocaram a planilha pelo Fortixx.</h2>
          </div>
          <div className="testi-grid">
            {TESTIMONIALS.map((t, i) => (
              <div key={t.name} className="testi-card reveal" style={{ transitionDelay: `${0.1 * i}s` }}>
                <div className="testi-result">{t.result}</div>
                <p className="testi-quote">&ldquo;{t.quote}&rdquo;</p>
                <div className="testi-person">
                  <div className="testi-avatar" style={{ background: t.color }}>{t.initials}</div>
                  <div>
                    <div className="testi-name">{t.name}</div>
                    <div className="testi-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="preços" className="section">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow reveal">Preços</span>
            <h2 className="section-title reveal reveal-delay-1">Simples. Sem surpresas.</h2>
            <p className="section-sub reveal reveal-delay-2">Cancele quando quiser. Sem multa, sem letra miúda.</p>
          </div>
          <div className="pricing-grid">
            {PLANS.map((p, i) => (
              <div key={p.id} className={`price-card reveal ${p.popular ? 'pro' : ''}`} style={{ transitionDelay: `${0.1 * i}s` }}>
                {p.popular && <div className="price-banner">★ Mais escolhido</div>}
                <div className="price-card-body">
                  <div>
                    <div className="plan-name">{p.name}</div>
                    {p.popular && <div className="discount-pill">Economize 20% no anual</div>}
                    {p.custom && <div className="custom-pill">Sob medida</div>}
                    <p className="plan-desc">{p.desc}</p>
                  </div>
                  {!p.custom ? (
                    (() => {
                      const monthly = p.monthly as number;
                      const oldMonthly = p.oldMonthly as number;
                      const yearly = p.yearly as number;
                      const save = (oldMonthly - monthly).toFixed(0).replace('.', ',');
                      return (
                        <div>
                          <div className="price-old">De R$ {oldMonthly.toFixed(2).replace('.', ',')} /mês</div>
                          <div className="price-now">
                            <span className="currency">R$</span>
                            <span className="amount">{Math.floor(monthly)}</span>
                            <span className="period">,{(monthly % 1).toFixed(2).slice(2)} /mês</span>
                          </div>
                          <div className="price-yearly">ou R$ {yearly.toLocaleString('pt-BR')} /ano</div>
                          <div className="price-save" style={{ marginTop: 6 }}>Economia de R$ {save} /mês</div>
                        </div>
                      );
                    })()
                  ) : (
                    <div>
                      <div className="enterprise-price">Sob Consulta</div>
                      <div className="price-yearly">Proposta personalizada</div>
                    </div>
                  )}
                  <div className="price-divider" />
                  <ul className="check-list">
                    {p.features.map((feat) => (
                      <li key={feat}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>{feat}</li>
                    ))}
                  </ul>
                  <button onClick={() => openModal(p.name)} className={`btn ${p.popular ? 'btn-gold' : 'btn-primary'} btn-block`}>
                    {p.custom ? 'Falar com vendas' : 'Começar agora'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="pricing-note reveal">Todos os planos incluem 2FA, LGPD-compliant e suporte brasileiro.</p>
        </div>
      </section>

      <section id="faq" className="section">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow reveal">FAQ</span>
            <h2 className="section-title reveal reveal-delay-1">Perguntas que toda gente de RH faz.</h2>
          </div>
          <div className="faq-list">
            {FAQS.map((f, i) => (
              <div key={f.q} className={`faq-item reveal ${openFaq === i ? 'open' : ''}`}>
                <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <div>
                    <span className="tag">{f.tag}</span>
                    {f.q}
                  </div>
                  <svg className="faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                <div className="faq-a" style={{ maxHeight: openFaq === i ? 240 : 0 }}>
                  <div className="faq-a-inner">{f.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="final-cta-card reveal">
            <h2 className="final-cta-title">Pronto pra tirar o RH do caos?</h2>
            <p className="final-cta-sub">Agende uma demonstração de 20 minutos. Sem compromisso, sem ligação chata.</p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => openModal('Demonstração')} className="btn btn-gold btn-primary btn-magnetic">Solicitar Demonstração</button>
              <a href="/login" className="btn btn-ghost btn-magnetic">Já sou cliente</a>
            </div>
            <p className="final-cta-note">Resposta em até 1 dia útil · sem precisar de cartão</p>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="footer-top">
            <div>
              <div className="logo">
                <span className="logo-badge"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4 L20 4 L20 9 L12 9 L12 15 L20 15 L20 20 L4 20 Z" /></svg></span>
                <span style={{ marginLeft: 8 }}>Fortixx</span>
              </div>
              <p className="footer-brand-desc">RH sem fricção pra times brasileiros que crescem rápido.</p>
            </div>
            <div className="footer-col"><h5>Produto</h5><a href="#recursos">Recursos</a><a href="#preços">Preços</a><a href="#historia">Como funciona</a></div>
            <div className="footer-col"><h5>Empresa</h5><a href="#">Sobre</a><a href="#">Carreiras</a><a href="#">Imprensa</a></div>
            <div className="footer-col"><h5>Recursos</h5><a href="#">Blog</a><a href="#">Central de ajuda</a><a href="#">Status</a></div>
            <div className="footer-col"><h5>Legal</h5><a href="#">Privacidade</a><a href="#">Termos</a><a href="#">LGPD</a></div>
          </div>
          <div className="footer-bottom">
            <div>© 2026 Fortixx Tecnologia · CNPJ 00.000.000/0001-00 · São Paulo, BR</div>
            <div className="footer-socials">
              <a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zM17.5 6.5h.01" /></svg></a>
              <a href="#" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM6 5a2 2 0 11-4 0 2 2 0 014 0z" /></svg></a>
              <a href="#" aria-label="GitHub"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.44 9.79 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.05-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.31-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.87.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.22.7.83.58A12 12 0 0024 12c0-6.63-5.37-12-12-12z" /></svg></a>
            </div>
          </div>
        </div>
      </footer>

      <div className={`sticky-cta ${stickyVisible ? 'show' : ''}`}>
        <div className="sticky-cta-inner wrap">
          <div className="sticky-cta-text">Pronto pra ver o Fortixx funcionando?</div>
          <div className="sticky-cta-actions">
            <button onClick={() => openModal('Demonstração')} className="btn btn-gold btn-sm">Solicitar Demonstração</button>
            <span className="sticky-cta-note">Sem cartão · resposta em 24h</span>
          </div>
        </div>
      </div>

      <div className={`modal-overlay ${modalOpen ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && closeModal()}>
        <div className="modal-box">
          <div className="modal-head">
            <div>
              <div className="modal-title">Vamos começar?</div>
              <div className="modal-plan">{modalPlan}</div>
            </div>
            <button className="modal-close" onClick={closeModal} aria-label="Fechar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flow-steps">
            {[1, 2, 3].map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className={`flow-step ${modalStep >= s ? 'current' : ''}`}>{s}. {s === 1 ? 'Você' : s === 2 ? 'Empresa' : 'Agendamento'}</div>
                {i < 2 && <span className="flow-arrow">→</span>}
              </div>
            ))}
          </div>
          <div className="modal-fields">
            <div><label className="field-label">Nome completo</label><input className="field-input" type="text" placeholder="Seu nome" /></div>
            <div><label className="field-label">E-mail corporativo</label><input className="field-input" type="email" placeholder="voce@empresa.com.br" /></div>
            <div className="full"><label className="field-label">Empresa</label><input className="field-input" type="text" placeholder="Nome da empresa" /></div>
            <div className="full"><label className="field-label">Tamanho do time</label>
              <select className="field-input">
                <option>1 a 25 colaboradores</option>
                <option>26 a 100 colaboradores</option>
                <option>101 a 500 colaboradores</option>
                <option>500+ colaboradores</option>
              </select>
            </div>
            <div className="full"><label className="field-label">Mensagem (opcional)</label><input className="field-input" type="text" placeholder="O que você quer resolver?" /></div>
          </div>
          <button onClick={() => setModalStep(Math.min(3, modalStep + 1))} className="btn btn-primary btn-block">
            {modalStep < 3 ? 'Continuar' : 'Enviar'}
          </button>
          <p className="modal-disclaimer">Seus dados ficam seguros · LGPD compliant</p>
        </div>
      </div>
    </>
  );
}