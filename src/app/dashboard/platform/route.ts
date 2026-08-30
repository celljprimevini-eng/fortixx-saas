import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { platformStyle } from '../_platform/style';
import { platformBody } from '../_platform/body';
import { platformScript } from '../_platform/script';

/**
 * Serve o dashboard "Plataforma de RH" completo (o protótipo fortixx-plataforma.html
 * que a Renata validou) como um documento HTML isolado, carregado num iframe por
 * /dashboard. Fica isolado de propósito: é uma UI vanilla HTML/CSS/JS gigante e
 * auto-suficiente — portar módulo a módulo pra React é o próximo passo, não um
 * bloqueio pra já estar rodando dentro do app real.
 *
 * Protegido pelo mesmo middleware que protege /dashboard/* (login + AAL2).
 *
 * 2026-08-30: os três blocos mais visíveis (Colaboradores→Diretório,
 * Recrutamento→Vagas+Pipeline, Onboarding→Checklist) passam a ser preenchidos com
 * dado real do tenant via substituição de string no HTML do protótipo, em vez do
 * conteúdo de demonstração fixo. Os demais sub-módulos (Escalas, Organograma,
 * Currículos, Entrevistas, Aprovações, Documentos, Treinamentos, Assistente RH,
 * Analytics, Configurações) continuam com o conteúdo de demonstração original —
 * portar cada um é trabalho à parte, não incluído nesta passada.
 */
export const runtime = 'nodejs';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

const STATUS_PILL: Record<string, { cls: string; label: string }> = {
  active: { cls: 'ok', label: 'Ativo' },
  inactive: { cls: 'danger', label: 'Inativo' },
  on_leave: { cls: 'pending', label: 'Afastado' },
};

const JOB_STATUS_PILL: Record<string, { cls: string; label: string }> = {
  open: { cls: 'ok', label: 'Aberta' },
  paused: { cls: 'pending', label: 'Pausada' },
  closed: { cls: 'neutral', label: 'Encerrada' },
};

export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  let html = `<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Fortixx — Plataforma de RH</title>
<meta name="theme-color" content="#0A0A0A" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#FAFAFA" media="(prefers-color-scheme: light)">
<meta name="color-scheme" content="dark light">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>${platformStyle}</style>
</head>
<body>
${platformBody}
<script>${platformScript}</script>
</body>
</html>`;

  if (!user) {
    return new NextResponse(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) {
    return new NextResponse(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const [
    { data: colaboradores },
    { data: departments },
    { data: jobOpenings },
    { data: candidates },
    { data: onboardings },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, job_title, department_id, status, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
    supabase.from('departments').select('id, name').eq('tenant_id', tenantId),
    supabase.from('job_openings').select('id, title, department_id, location, employment_type, status').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(30),
    supabase.from('candidates').select('id, full_name, job_opening_id, stage').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100),
    supabase.from('onboardings').select('id, profile_id, status, start_date, profiles(full_name, job_title)').eq('tenant_id', tenantId).eq('status', 'em_andamento').limit(20),
  ]) as unknown as [
    { data: { id: string; full_name: string; job_title: string | null; department_id: string | null; status: string; created_at: string }[] | null },
    { data: { id: string; name: string }[] | null },
    { data: { id: string; title: string; department_id: string | null; location: string | null; employment_type: string; status: string }[] | null },
    { data: { id: string; full_name: string; job_opening_id: string | null; stage: string }[] | null },
    { data: { id: string; profile_id: string; status: string; start_date: string; profiles: { full_name: string; job_title: string | null } | { full_name: string; job_title: string | null }[] | null }[] | null },
  ];

  const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const jobMap = new Map((jobOpenings ?? []).map((j) => [j.id, j.title]));

  // ---- Colaboradores > Diretório ----
  if (colaboradores) {
    const rows = colaboradores.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">Nenhum colaborador cadastrado ainda.</td></tr>`
      : colaboradores.map((c) => {
          const dept = c.department_id ? (deptMap.get(c.department_id) ?? '—') : '—';
          const pill = STATUS_PILL[c.status] ?? STATUS_PILL.active;
          const name = escapeHtml(c.full_name);
          const role = escapeHtml(c.job_title ?? '—');
          return `<tr><td><div class="cell-person"><span class="avatar-circle" style="background:linear-gradient(135deg,var(--blue),var(--blue-deep))">${escapeHtml(initials(c.full_name))}</span><div><div class="name">${name}</div><div class="sub">${role}</div></div></div></td><td>${escapeHtml(dept)}</td><td>${formatDate(c.created_at)}</td><td><span class="status-pill ${pill.cls}">${pill.label}</span></td><td><button class="btn btn-ghost btn-sm" data-open-drawer data-name="${name}" data-role="${role}" data-dept="${escapeHtml(dept)}" data-admission="${formatDate(c.created_at)}">Ver perfil</button></td></tr>`;
        }).join('');

    html = html.replace(
      /(<thead><tr><th>Colaborador<\/th><th>Departamento<\/th><th>Admissão<\/th><th>Status<\/th><th><\/th><\/tr><\/thead>\s*<tbody>)[\s\S]*?(<\/tbody>)/,
      `$1${rows}$2`
    );
  }

  // ---- Recrutamento > Vagas ----
  if (jobOpenings) {
    const cards = jobOpenings.length === 0
      ? `<p class="muted" style="padding:24px">Nenhuma vaga aberta ainda.</p>`
      : jobOpenings.map((j) => {
          const pill = JOB_STATUS_PILL[j.status] ?? JOB_STATUS_PILL.open;
          const count = (candidates ?? []).filter((c) => c.job_opening_id === j.id).length;
          const dept = j.department_id ? (deptMap.get(j.department_id) ?? '') : '';
          const loc = j.location ? escapeHtml(j.location) : '—';
          return `<div class="panel glass"><div class="panel-head"><h3>${escapeHtml(j.title)}</h3><span class="status-pill ${pill.cls}">${pill.label}</span></div><p class="muted" style="font-size:.84rem;margin-bottom:14px">${escapeHtml(dept)}${dept ? ' · ' : ''}${loc}</p><div class="mini-row" style="border:none;padding:0"><span class="muted" style="font-size:.8rem">${count} candidatura${count === 1 ? '' : 's'}</span></div></div>`;
        }).join('');

    html = html.replace(
      /(<div class="subview active" id="recrut-vagas">\s*<div class="dash-row thirds">)[\s\S]*?(<\/div>\s*<\/div>)/,
      `$1${cards}$2`
    );
  }

  // ---- Recrutamento > Pipeline ----
  if (candidates) {
    const stageGroups: Record<string, typeof candidates> = {
      Triagem: candidates.filter((c) => ['recebido', 'triagem', 'analise'].includes(c.stage)),
      Entrevista: candidates.filter((c) => c.stage === 'entrevista'),
      Contratado: candidates.filter((c) => c.stage === 'aprovado'),
    };
    const columns = Object.entries(stageGroups).map(([label, list]) => {
      const cards = list.length === 0
        ? ''
        : list.map((c) => `<div class="kanban-card"><strong>${escapeHtml(c.full_name)}</strong><span class="role">${escapeHtml(c.job_opening_id ? (jobMap.get(c.job_opening_id) ?? '—') : '—')}</span></div>`).join('');
      return `<div class="kanban-col"><div class="kanban-col-head">${label} <span class="kanban-count">${list.length}</span></div><div class="kanban-dropzone">${cards}</div></div>`;
    }).join('');

    html = html.replace(
      /(<div class="subview" id="recrut-pipeline">\s*<div class="kanban-board">)[\s\S]*?(<\/div>\s*<\/div>)/,
      `$1${columns}$2`
    );
  }

  // ---- Onboarding > Checklist ----
  if (onboardings) {
    let onbCards = '';
    if (onboardings.length === 0) {
      onbCards = `<p class="muted" style="padding:24px">Nenhum onboarding em andamento.</p>`;
    } else {
      const onboardingIds = onboardings.map((o) => o.id);
      const { data: tasks } = await supabase
        .from('onboarding_tasks')
        .select('onboarding_id, title, done')
        .in('onboarding_id', onboardingIds)
        .order('order_index', { ascending: true });

      const computed = onboardings.map((o) => {
        const person = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
        const myTasks = (tasks ?? []).filter((t) => t.onboarding_id === o.id);
        const done = myTasks.filter((t) => t.done).length;
        const pct = myTasks.length > 0 ? Math.round((done / myTasks.length) * 100) : 0;
        const dayNum = o.start_date ? Math.max(1, Math.floor((Date.now() - new Date(o.start_date).getTime()) / 86400000) + 1) : 1;
        const name = person?.full_name ? escapeHtml(person.full_name) : 'Colaborador';
        const role = person?.job_title ? escapeHtml(person.job_title) : '—';
        return { name, role, pct, dayNum, myTasks };
      });

      onbCards = computed.map(({ name, role, pct, dayNum, myTasks }, idx) => {
        const taskRows = myTasks.length === 0
          ? '<div class="onb-task"><span class="onb-check"></span><span class="label">Nenhuma tarefa cadastrada</span></div>'
          : myTasks.map((t) => `<div class="onb-task ${t.done ? 'done' : ''}"><span class="onb-check">${t.done ? '✓' : ''}</span><span class="label">${escapeHtml(t.title)}</span></div>`).join('');
        return `<div class="onb-emp-card glass${idx === 0 ? ' expanded' : ''}"><div class="onb-emp-top"><div class="cell-person"><span class="avatar-circle" style="background:linear-gradient(135deg,var(--gold),#F59E0B);color:#1a1300">${escapeHtml(initials(name))}</span><div><div class="name">${name}</div><div class="sub">${role} · Dia ${dayNum} de 30</div></div></div><button class="expand-toggle" data-toggle-onb><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div><div class="progress-row"><span>Progresso</span><span>${pct}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><div class="onb-checklist">${taskRows}</div></div>`;
      }).join('');

      // ---- Onboarding > Status de integração ----
      const statusRows = computed.map(({ name, role, pct, dayNum }) => {
        const pill = pct >= 70 ? { cls: 'ok', label: 'No prazo' } : pct >= 30 ? { cls: 'pending', label: 'Em dia' } : { cls: 'pending', label: 'Início' };
        return `<tr><td>${name}</td><td>${dayNum}/30</td><td>${pct}%</td><td>${role}</td><td><span class="status-pill ${pill.cls}">${pill.label}</span></td></tr>`;
      }).join('');
      html = html.replace(
        /(<div class="subview" id="onb-status">\s*<div class="table-wrap glass">\s*<table class="data-table">\s*<thead><tr><th>Colaborador<\/th><th>Dia<\/th><th>Progresso<\/th><th>Responsável<\/th><th>Status<\/th><\/tr><\/thead>\s*<tbody>)[\s\S]*?(<\/tbody>)/,
        `$1${statusRows || '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">Nenhum onboarding em andamento.</td></tr>'}$2`
      );
    }

    html = html.replace(
      /(<div class="subview active" id="onb-checklist">)[\s\S]*?(<div class="subview" id="onb-documentos">)/,
      `$1${onbCards}$2`
    );
  }

  // ---- Recrutamento > Banco de currículos ----
  if (candidates) {
    const rows = candidates.length === 0
      ? `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted)">Nenhum candidato ainda.</td></tr>`
      : candidates.slice(0, 20).map((c) => {
          const jobTitle = c.job_opening_id ? (jobMap.get(c.job_opening_id) ?? '—') : '—';
          return `<tr><td>${escapeHtml(c.full_name)}</td><td>${escapeHtml(jobTitle)}</td><td><div class="tags"></div></td><td>—</td></tr>`;
        }).join('');
    html = html.replace(
      /(<thead><tr><th>Candidato<\/th><th>Cargo de interesse<\/th><th>Habilidades<\/th><th>Data<\/th><\/tr><\/thead>\s*<tbody>)[\s\S]*?(<\/tbody>)/,
      `$1${rows}$2`
    );

    // ---- Recrutamento > Dashboard (funil real) ----
    const total = candidates.length;
    const stageCounts = {
      Candidaturas: total,
      Triagem: candidates.filter((c) => ['recebido', 'triagem', 'analise', 'entrevista', 'aprovado'].includes(c.stage)).length,
      Entrevista: candidates.filter((c) => ['entrevista', 'aprovado'].includes(c.stage)).length,
      Proposta: candidates.filter((c) => c.stage === 'aprovado').length,
      Contratado: candidates.filter((c) => c.stage === 'aprovado').length,
    };
    const maxCount = Math.max(1, total);
    const funnelRows = Object.entries(stageCounts).map(([label, count]) => {
      const pct = Math.round((count / maxCount) * 100);
      return `<div class="funnel-row"><span class="funnel-label">${label}</span><div class="funnel-bar-wrap"><div class="funnel-bar" style="width:${pct}%">${count}</div></div></div>`;
    }).join('');
    html = html.replace(
      /(<div class="funnel">)[\s\S]*?(<\/div>\s*<\/div>\s*<div class="panel glass">\s*<div class="panel-head"><h3>Tempo médio de contratação)/,
      `$1${funnelRows}$2`
    );
  }

  // ---- Configurações > Usuários ----
  if (colaboradores) {
    const rows = colaboradores.length === 0
      ? `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted)">Nenhum usuário ainda.</td></tr>`
      : colaboradores.map((c) => {
          const pill = STATUS_PILL[c.status] ?? STATUS_PILL.active;
          const roleTag = c.job_title ? escapeHtml(c.job_title) : 'Colaborador';
          return `<tr><td><div class="cell-person"><span class="avatar-circle" style="background:linear-gradient(135deg,var(--blue),var(--blue-deep))">${escapeHtml(initials(c.full_name))}</span><div><div class="name">${escapeHtml(c.full_name)}</div><div class="sub"></div></div></div></td><td><span class="tag">${roleTag}</span></td><td><span class="status-pill ${pill.cls}">${pill.label}</span></td><td>—</td></tr>`;
        }).join('');
    html = html.replace(
      /(<thead><tr><th>Usuário<\/th><th>Papel<\/th><th>Status<\/th><th>Último acesso<\/th><\/tr><\/thead>\s*<tbody>)[\s\S]*?(<\/tbody>)/,
      `$1${rows}$2`
    );
  }

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
