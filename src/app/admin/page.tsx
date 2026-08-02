'use client';

/**
 * /admin — painel pra editar a landing do tenant logado.
 *
 * Salva em `site_config` (Supabase) via `saveSiteConfig`. RLS garante
 * que só admin do tenant pode escrever.
 *
 * 4 abas:
 *  - Marca: nome, inicial do logo, tagline, descrição, cores (primary + accent)
 *  - Hero: eyebrow, título, subtítulo, CTAs, trust badges
 *  - Planos: lista de planos (nome, preço, features, popular)
 *  - FAQ & Depoimentos: lista editável
 *
 * Preview ao vivo no canto direito mostra como vai ficar.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient as createBrowserSupabase } from '@/lib/supabase/client';
import {
  DEFAULT_CONFIG,
  getMySiteConfig,
  saveSiteConfig,
  type SiteConfig,
  type PlanConfig,
  type FaqItem,
  type Testimonial,
} from '@/lib/site/config';

type Tab = 'brand' | 'hero' | 'plans' | 'faq';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [cfg, setCfg] = useState<SiteConfig>(DEFAULT_CONFIG);
  const [tab, setTab] = useState<Tab>('brand');

  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabase();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push('/auth/login?next=/admin');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (profile?.role !== 'admin') {
        setMessage({ kind: 'err', text: 'Apenas admin pode editar o site.' });
        setLoading(false);
        return;
      }
      const current = await getMySiteConfig();
      setCfg(current);
      setLoading(false);
    })();
  }, [router]);

  function update<K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) {
    setCfg((c) => ({ ...c, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const res = await saveSiteConfig(cfg);
    setSaving(false);
    if (res.ok) setMessage({ kind: 'ok', text: 'Salvo! A landing já reflete essas mudanças.' });
    else setMessage({ kind: 'err', text: res.error ?? 'Erro ao salvar' });
  }

  function handleReset() {
    if (!confirm('Restaurar o site pro padrão Fortixx? Suas customizações serão perdidas.')) return;
    setCfg({ ...DEFAULT_CONFIG });
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0A0A0A', color: '#FAFAFA', fontFamily: 'system-ui' }}>
        Carregando…
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#FAFAFA', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', color: '#1a1300', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
            {cfg.brandInitial}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>Editar site — {cfg.brandName}</div>
            <div style={{ fontSize: 12, color: 'rgba(250,250,250,0.5)' }}>As mudanças aparecem na landing em segundos</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleReset} style={btnSecondary}>Restaurar padrão</button>
          <a href="/" target="_blank" style={btnSecondary}>Ver landing ↗</a>
          <button onClick={handleSave} disabled={saving} style={btnPrimary}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </header>

      {message && (
        <div
          style={{
            margin: '14px 32px 0',
            padding: '12px 16px',
            borderRadius: 10,
            background: message.kind === 'ok' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
            border: `1px solid ${message.kind === 'ok' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color: message.kind === 'ok' ? '#34D399' : '#F87171',
            fontSize: 14,
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, padding: 24 }}>
        {/* Coluna esquerda: abas + form */}
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
            <TabBtn current={tab} value="brand" onClick={setTab}>Marca</TabBtn>
            <TabBtn current={tab} value="hero" onClick={setTab}>Hero</TabBtn>
            <TabBtn current={tab} value="plans" onClick={setTab}>Planos</TabBtn>
            <TabBtn current={tab} value="faq" onClick={setTab}>FAQ & Depoimentos</TabBtn>
          </div>

          {tab === 'brand' && <BrandTab cfg={cfg} update={update} />}
          {tab === 'hero' && <HeroTab cfg={cfg} update={update} />}
          {tab === 'plans' && <PlansTab cfg={cfg} setCfg={setCfg} />}
          {tab === 'faq' && <FaqTestiTab cfg={cfg} setCfg={setCfg} />}
        </div>

        {/* Coluna direita: preview ao vivo */}
        <Preview cfg={cfg} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tabs
// ────────────────────────────────────────────────────────────────────────────

function TabBtn({ current, value, onClick, children }: { current: Tab; value: Tab; onClick: (t: Tab) => void; children: React.ReactNode }) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      style={{
        padding: '8px 14px',
        borderRadius: 100,
        border: '1px solid rgba(255,255,255,0.12)',
        background: active ? '#2563EB' : 'transparent',
        color: active ? '#fff' : 'rgba(250,250,250,0.7)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function BrandTab({ cfg, update }: { cfg: SiteConfig; update: <K extends keyof SiteConfig>(k: K, v: SiteConfig[K]) => void }) {
  return (
    <Card title="Identidade da marca">
      <Field label="Nome da empresa" value={cfg.brandName} onChange={(v) => update('brandName', v)} />
      <Field label="Inicial do logo (1 caractere)" value={cfg.brandInitial} onChange={(v) => update('brandInitial', v.slice(0, 1).toUpperCase())} maxLength={1} />
      <Field label="Tagline (meta description)" value={cfg.brandTagline} onChange={(v) => update('brandTagline', v)} />
      <Field label="Descrição (footer)" value={cfg.brandDescription} onChange={(v) => update('brandDescription', v)} multiline />
      <Field label="Cor primária (hex sem #)" value={cfg.colorPrimary} onChange={(v) => update('colorPrimary', v.replace('#', ''))} />
      <Field label="Cor de destaque (hex sem #)" value={cfg.colorAccent} onChange={(v) => update('colorAccent', v.replace('#', ''))} />
      <Field label="Copyright (footer)" value={cfg.footerCopyright} onChange={(v) => update('footerCopyright', v)} />
    </Card>
  );
}

function HeroTab({ cfg, update }: { cfg: SiteConfig; update: <K extends keyof SiteConfig>(k: K, v: SiteConfig[K]) => void }) {
  return (
    <>
      <Card title="Anúncio do topo">
        <Field label="Texto" value={cfg.announcement} onChange={(v) => update('announcement', v)} />
        <Field label="CTA (ex: 'Ver planos →')" value={cfg.announcementCta} onChange={(v) => update('announcementCta', v)} />
        <Field label="Link (ex: '#pricing')" value={cfg.announcementLink} onChange={(v) => update('announcementLink', v)} />
      </Card>
      <Card title="Hero (acima da dobra)">
        <Field label="Eyebrow" value={cfg.heroEyebrow} onChange={(v) => update('heroEyebrow', v)} />
        <Field label="Título (parte normal)" value={cfg.heroTitleLead} onChange={(v) => update('heroTitleLead', v)} />
        <Field label="Título (parte destacada/dourada)" value={cfg.heroTitleAccent} onChange={(v) => update('heroTitleAccent', v)} />
        <Field label="Subtítulo" value={cfg.heroSub} onChange={(v) => update('heroSub', v)} multiline />
        <Field label="CTA primário" value={cfg.heroCtaPrimary} onChange={(v) => update('heroCtaPrimary', v)} />
        <Field label="CTA secundário" value={cfg.heroCtaSecondary} onChange={(v) => update('heroCtaSecondary', v)} />
        <ListField
          label="Trust badges (1 por linha)"
          values={cfg.trustBadges}
          onChange={(v) => update('trustBadges', v)}
        />
      </Card>
    </>
  );
}

function PlansTab({ cfg, setCfg }: { cfg: SiteConfig; setCfg: React.Dispatch<React.SetStateAction<SiteConfig>> }) {
  function updatePlan(idx: number, patch: Partial<PlanConfig>) {
    setCfg((c) => {
      const plans = [...c.plans];
      plans[idx] = { ...plans[idx], ...patch };
      return { ...c, plans };
    });
  }
  function addPlan() {
    setCfg((c) => ({
      ...c,
      plans: [
        ...c.plans,
        { id: `plan-${Date.now()}`, name: 'Novo plano', desc: '', ctaLabel: 'Começar', ctaAction: 'open-modal', features: [] },
      ],
    }));
  }
  function removePlan(idx: number) {
    if (!confirm('Remover este plano?')) return;
    setCfg((c) => ({ ...c, plans: c.plans.filter((_, i) => i !== idx) }));
  }
  return (
    <Card title={`Planos (${cfg.plans.length})`} right={<button onClick={addPlan} style={btnGhost}>+ Adicionar</button>}>
      {cfg.plans.map((p, i) => (
        <div key={p.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ fontSize: 14 }}>{p.name || '(sem nome)'}</strong>
            <button onClick={() => removePlan(i)} style={{ ...btnGhost, color: '#F87171' }}>Remover</button>
          </div>
          <Field label="Nome" value={p.name} onChange={(v) => updatePlan(i, { name: v })} />
          <Field label="Descrição" value={p.desc} onChange={(v) => updatePlan(i, { desc: v })} multiline />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Preço (R$/mês)" value={String(p.monthly ?? '')} onChange={(v) => updatePlan(i, { monthly: v ? Number(v) : undefined })} type="number" />
            <Field label="Preço antigo (R$/mês)" value={String(p.oldMonthly ?? '')} onChange={(v) => updatePlan(i, { oldMonthly: v ? Number(v) : undefined })} type="number" />
          </div>
          <Field label="Rótulo do CTA" value={p.ctaLabel} onChange={(v) => updatePlan(i, { ctaLabel: v })} />
          <ListField
            label="Features (1 por linha)"
            values={p.features}
            onChange={(v) => updatePlan(i, { features: v })}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(250,250,250,0.7)', marginTop: 8 }}>
            <input type="checkbox" checked={p.popular ?? false} onChange={(e) => updatePlan(i, { popular: e.target.checked })} />
            Marcar como &ldquo;Mais Escolhido&rdquo;
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(250,250,250,0.7)', marginTop: 6 }}>
            <input type="checkbox" checked={p.custom ?? false} onChange={(e) => updatePlan(i, { custom: e.target.checked })} />
            É &ldquo;Sob Consulta&rdquo; (esconde preço)
          </label>
        </div>
      ))}
    </Card>
  );
}

function FaqTestiTab({ cfg, setCfg }: { cfg: SiteConfig; setCfg: React.Dispatch<React.SetStateAction<SiteConfig>> }) {
  function updateFaq(idx: number, patch: Partial<FaqItem>) {
    setCfg((c) => {
      const faqs = [...c.faqs];
      faqs[idx] = { ...faqs[idx], ...patch };
      return { ...c, faqs };
    });
  }
  function addFaq() {
    setCfg((c) => ({ ...c, faqs: [...c.faqs, { tag: 'Nova', q: '', a: '' }] }));
  }
  function removeFaq(idx: number) {
    setCfg((c) => ({ ...c, faqs: c.faqs.filter((_, i) => i !== idx) }));
  }
  function updateTesti(idx: number, patch: Partial<Testimonial>) {
    setCfg((c) => {
      const t = [...c.testimonials];
      t[idx] = { ...t[idx], ...patch };
      return { ...c, testimonials: t };
    });
  }
  return (
    <>
      <Card title="FAQ" right={<button onClick={addFaq} style={btnGhost}>+ Adicionar</button>}>
        {cfg.faqs.map((f, i) => (
          <div key={i} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <Field label="Tag" value={f.tag} onChange={(v) => updateFaq(i, { tag: v })} />
            <Field label="Pergunta" value={f.q} onChange={(v) => updateFaq(i, { q: v })} />
            <Field label="Resposta" value={f.a} onChange={(v) => updateFaq(i, { a: v })} multiline />
            <button onClick={() => removeFaq(i)} style={{ ...btnGhost, color: '#F87171', marginTop: 4 }}>Remover</button>
          </div>
        ))}
      </Card>
      <Card title="Depoimentos">
        {cfg.testimonials.map((t, i) => (
          <div key={i} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <Field label="Resultado (ex: ↓ 64% no tempo)" value={t.result} onChange={(v) => updateTesti(i, { result: v })} />
            <Field label="Citação" value={t.quote} onChange={(v) => updateTesti(i, { quote: v })} multiline />
            <Field label="Nome" value={t.name} onChange={(v) => updateTesti(i, { name: v })} />
            <Field label="Cargo" value={t.role} onChange={(v) => updateTesti(i, { role: v })} />
            <Field label="Iniciais (2 letras)" value={t.initials} onChange={(v) => updateTesti(i, { initials: v.slice(0, 2).toUpperCase() })} maxLength={2} />
          </div>
        ))}
      </Card>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Componentes auxiliares
// ────────────────────────────────────────────────────────────────────────────

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18, marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, multiline, type, maxLength }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; type?: string; maxLength?: number }) {
  const style: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#FAFAFA', fontSize: 14, fontFamily: 'inherit' };
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(250,250,250,0.6)', marginBottom: 6 }}>{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...style, resize: 'vertical' }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} type={type ?? 'text'} maxLength={maxLength} style={style} />
      )}
    </div>
  );
}

function ListField({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const text = values.join('\n');
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(250,250,250,0.6)', marginBottom: 6 }}>{label}</label>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value.split('\n').filter((s) => s.length > 0))}
        rows={Math.max(3, values.length)}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#FAFAFA', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
      />
    </div>
  );
}

function Preview({ cfg }: { cfg: SiteConfig }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28, position: 'sticky', top: 24, maxHeight: 'calc(100vh - 60px)', overflowY: 'auto' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(250,250,250,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 18 }}>Preview ao vivo</div>

      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#FBBF24,#F59E0B)', color: '#1a1300', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
            {cfg.brandInitial}
          </div>
          <strong>{cfg.brandName}</strong>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(250,250,250,0.5)', marginBottom: 14 }}>{cfg.announcement}</div>
        <div style={{ fontSize: 11, color: 'rgba(250,250,250,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Hero</div>
        <div style={{ fontSize: 11, color: 'rgba(91,141,239,1)', marginBottom: 6 }}>{cfg.heroEyebrow}</div>
        <h1 style={{ margin: '8px 0', fontSize: 28, lineHeight: 1.1, fontWeight: 600 }}>
          {cfg.heroTitleLead}<span style={{ color: `#${cfg.colorAccent}` }}>{cfg.heroTitleAccent}</span>
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(250,250,250,0.6)', lineHeight: 1.5 }}>{cfg.heroSub}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button style={{ ...btnPrimary, fontSize: 13, padding: '10px 16px' }}>{cfg.heroCtaPrimary}</button>
          <button style={{ ...btnSecondary, fontSize: 13, padding: '10px 16px' }}>{cfg.heroCtaSecondary}</button>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: 'rgba(250,250,250,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Planos</div>
        {cfg.plans.map((p) => (
          <div key={p.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, marginBottom: 8, background: p.popular ? 'rgba(37,99,235,0.08)' : 'transparent' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ fontSize: 14 }}>{p.name}</strong>
              {p.custom ? (
                <span style={{ fontSize: 14, color: 'rgba(250,250,250,0.6)' }}>Sob Consulta</span>
              ) : (
                <span style={{ fontSize: 18, fontWeight: 700 }}>R$ {p.monthly?.toFixed(2).replace('.', ',')}<span style={{ fontSize: 11, color: 'rgba(250,250,250,0.5)' }}>/mês</span></span>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'rgba(250,250,250,0.6)', margin: '6px 0' }}>{p.desc}</p>
            <div style={{ fontSize: 11, color: 'rgba(250,250,250,0.5)' }}>{p.features.length} features</div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 11, color: 'rgba(250,250,250,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>FAQ ({cfg.faqs.length})</div>
        {cfg.faqs.map((f, i) => (
          <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '8px 0', fontSize: 13 }}>
            <strong>{f.q}</strong>
            <div style={{ color: 'rgba(250,250,250,0.5)', marginTop: 2 }}>{f.a.slice(0, 80)}{f.a.length > 80 ? '…' : ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Estilos de botão (declarados no fim pra não poluir o JSX principal)
// ────────────────────────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 100,
  border: 'none',
  background: '#2563EB',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 100,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent',
  color: 'rgba(250,250,250,0.8)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
};

const btnGhost: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent',
  color: 'rgba(250,250,250,0.8)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
