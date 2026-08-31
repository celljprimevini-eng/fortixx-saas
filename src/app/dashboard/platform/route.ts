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
 * Currículos, Entrevistas, Documentos, Treinamentos, Assistente RH,
 * Analytics, Configurações) continuam com o conteúdo de demonstração original —
 * portar cada um é trabalho à parte, não incluído nesta passada.
 *
 * 2026-08-31: Recrutamento→Aprovações passa a listar candidatos reais em
 * estágio 'entrevista' (aguardando decisão final), com data-candidate-id no
 * card pra os botões Aprovar/Recusar do script.ts chamarem as APIs reais
 * (api/recrutamento/[id]/approve e /reject). O tenant_id do usuário logado
 * também é injetado em <body data-tenant-id> pro botão "+ Convidar usuário"
 * (Configurações→Usuários) poder chamar api/onboarding vinculando o novo
 * usuário ao MESMO tenant (sem isso o RPC provision_user_tenant criaria uma
 * empresa nova).
 *
 * 2026-08-31 (parte 2, somente leitura): Colaboradores→Hierarquia da Empresa
 * passa a montar a árvore real a partir de profiles.manager_id (a coluna
 * existe no schema — 0001_initial_schema.sql), em vez de nomes fixos.
 * Onboarding→Documentos passa a listar a tabela `documents` real (já
 * alimentada pelo webhook n8n em api/webhooks/n8n), removendo os logs de
 * OCR simulados. Analytics ganha KPIs reais no topo (headcount ativo,
 * conversão do funil de recrutamento, onboardings em andamento, tempo médio
 * de contratação) calculados a partir dos mesmos dados já buscados nesta
 * rota; os widgets de tendência histórica (turnover mensal, ranking de
 * crescimento por departamento, satisfação, onboardings no prazo) continuam
 * decorativos porque o schema atual não guarda série histórica de headcount,
 * desligamentos ou pesquisas de satisfação — não há de onde tirar esse
 * número sem inventar.
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

const SHIFT_TYPE_LABEL: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  folga: 'Folga',
};

const SCHEDULE_STATUS_PILL: Record<string, { cls: string; label: string }> = {
  scheduled: { cls: 'pending', label: 'Agendado' },
  confirmed: { cls: 'ok', label: 'Confirmado' },
  completed: { cls: 'ok', label: 'Concluído' },
  absent: { cls: 'danger', label: 'Ausente' },
};

const DOCUMENT_CATEGORY: Record<string, { label: string; filterCat: string }> = {
  identidade: { label: 'Identidade', filterCat: 'identidade' },
  comprovante: { label: 'Comprovante', filterCat: 'comprovantes' },
  contrato: { label: 'Contrato', filterCat: 'contratos' },
  curriculo: { label: 'Currículo', filterCat: 'curriculo' },
  outro: { label: 'Outro', filterCat: 'outro' },
};

const APPROVAL_STATUS_PILL: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'pending', label: 'Em análise' },
  approved: { cls: 'ok', label: 'Aprovado' },
  rejected: { cls: 'danger', label: 'Recusado' },
};

const OCR_STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  processando: 'Processando',
  concluido: 'Concluído',
  falhou: 'Falhou',
  baixa_confianca: 'Baixa confiança',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

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

  // Injeta o tenant_id do usuário logado no <body>, pro script.ts poder mandar
  // como existing_tenant_id ao chamar api/onboarding (ver comentário no topo).
  html = html.replace('<body>', `<body data-tenant-id="${escapeHtml(tenantId)}">`);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [
    { data: colaboradores },
    { data: departments },
    { data: jobOpenings },
    { data: candidates },
    { data: onboardings },
    { data: schedules },
    { data: auditLogs },
    { data: orgProfiles },
    { data: documents },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, job_title, department_id, status, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
    supabase.from('departments').select('id, name').eq('tenant_id', tenantId),
    supabase.from('job_openings').select('id, title, department_id, location, employment_type, status').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(30),
    supabase.from('candidates').select('id, full_name, job_opening_id, stage, created_at, updated_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100),
    supabase.from('onboardings').select('id, profile_id, status, start_date, profiles(full_name, job_title)').eq('tenant_id', tenantId).eq('status', 'em_andamento').limit(20),
    supabase.from('schedules').select('id, profile_id, shift_date, shift_type, start_time, end_time, status, profiles(full_name)').eq('tenant_id', tenantId).gte('shift_date', monthStart).lte('shift_date', monthEnd).order('shift_date', { ascending: true }).limit(200),
    supabase.from('audit_logs').select('id, actor_id, action, entity_type, ip_address, created_at, profiles(full_name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
    // Colaboradores > Hierarquia da Empresa: precisa de manager_id/email/phone,
    // que a query de "colaboradores" acima não busca (e é limitada a 50, mas
    // aqui buscamos mais pra árvore ficar mais completa).
    supabase.from('profiles').select('id, full_name, job_title, department_id, manager_id, email, phone').eq('tenant_id', tenantId).order('full_name', { ascending: true }).limit(300),
    // Onboarding > Documentos: tabela real, já populada pelo webhook n8n
    // (document_ocr_completed) em api/webhooks/n8n/route.ts.
    supabase.from('documents').select('id, file_name, category, ocr_status, ocr_confidence, approval_status, created_at, profiles:profile_id(full_name), candidates:candidate_id(full_name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100),
  ]) as unknown as [
    { data: { id: string; full_name: string; job_title: string | null; department_id: string | null; status: string; created_at: string }[] | null },
    { data: { id: string; name: string }[] | null },
    { data: { id: string; title: string; department_id: string | null; location: string | null; employment_type: string; status: string }[] | null },
    { data: { id: string; full_name: string; job_opening_id: string | null; stage: string; created_at: string; updated_at: string }[] | null },
    { data: { id: string; profile_id: string; status: string; start_date: string; profiles: { full_name: string; job_title: string | null } | { full_name: string; job_title: string | null }[] | null }[] | null },
    { data: { id: string; profile_id: string; shift_date: string; shift_type: string; start_time: string | null; end_time: string | null; status: string; profiles: { full_name: string } | { full_name: string }[] | null }[] | null },
    { data: { id: string; actor_id: string | null; action: string; entity_type: string | null; ip_address: string | null; created_at: string; profiles: { full_name: string } | { full_name: string }[] | null }[] | null },
    { data: { id: string; full_name: string; job_title: string | null; department_id: string | null; manager_id: string | null; email: string; phone: string | null }[] | null },
    { data: { id: string; file_name: string; category: string | null; ocr_status: string | null; ocr_confidence: number | null; approval_status: string | null; created_at: string; profiles: { full_name: string } | { full_name: string }[] | null; candidates: { full_name: string } | { full_name: string }[] | null }[] | null },
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
      /<div class="subview active" id="recrut-vagas">\s*<div class="dash-row thirds">[\s\S]*?(?=<div class="subview" id="recrut-pipeline">)/,
      `<div class="subview active" id="recrut-vagas">\n<div class="dash-row thirds">${cards}</div>\n</div>\n`
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
      /<div class="subview" id="recrut-pipeline">\s*<div class="kanban-board">[\s\S]*?(?=<div class="subview" id="recrut-curriculos">)/,
      `<div class="subview" id="recrut-pipeline">\n<div class="kanban-board">${columns}</div>\n</div>\n`
    );
  }

  // ---- Recrutamento > Aprovações (candidatos em entrevista, aguardando decisão) ----
  if (candidates) {
    const pendentes = candidates.filter((c) => c.stage === 'entrevista');
    const items = pendentes.length === 0
      ? `<p class="muted" style="padding:24px">Nenhum candidato aguardando aprovação.</p>`
      : pendentes.map((c) => {
          const jobTitle = c.job_opening_id ? (jobMap.get(c.job_opening_id) ?? '—') : '—';
          return `<div class="approval-item glass" data-candidate-id="${escapeHtml(c.id)}"><div class="approval-info"><div class="t">Decisão final — ${escapeHtml(c.full_name)}</div><div class="d">${escapeHtml(jobTitle)}</div></div><div class="approval-actions"><span class="status-pill pending">Pendente</span><button class="btn btn-primary btn-sm btn-approve">Aprovar</button><button class="btn btn-danger-ghost btn-sm btn-reject">Recusar</button></div></div>`;
        }).join('');

    html = html.replace(
      /<div class="subview" id="recrut-aprovacoes">[\s\S]*?(?=<div class="subview" id="recrut-dashboard">)/,
      `<div class="subview" id="recrut-aprovacoes">${items}</div>\n`
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
        .select('id, onboarding_id, title, done')
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
          : myTasks.map((t) => `<div class="onb-task ${t.done ? 'done' : ''}"><span class="onb-check" data-task-id="${escapeHtml(t.id)}" role="checkbox" aria-checked="${t.done ? 'true' : 'false'}" tabindex="0">${t.done ? '✓' : ''}</span><span class="label">${escapeHtml(t.title)}</span></div>`).join('');
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
      /<div class="subview active" id="onb-checklist">[\s\S]*?(?=<div class="subview" id="onb-documentos">)/,
      `<div class="subview active" id="onb-checklist">${onbCards}</div>\n`
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

  // ---- Colaboradores > Escalas & Presença ----
  // A subview inteira era HTML decorativo fixo (calendário, faltas, confirmações
  // de leitura, histórico — nenhum vindo do banco). Nesta passada trocamos tudo
  // isso por uma tabela simples e real (colaborador, data, turno, status) com as
  // escalas do mês atual do tenant. Edição/criação de escala fica pra depois.
  if (schedules) {
    const rows = schedules.length === 0
      ? `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted)">Nenhuma escala cadastrada ainda.</td></tr>`
      : schedules.map((s) => {
          const person = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
          const name = escapeHtml(person?.full_name ?? '—');
          const shift = SHIFT_TYPE_LABEL[s.shift_type] ?? s.shift_type;
          const times = s.start_time && s.end_time ? ` · ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}` : '';
          const pill = SCHEDULE_STATUS_PILL[s.status] ?? SCHEDULE_STATUS_PILL.scheduled;
          return `<tr><td>${name}</td><td>${formatDate(s.shift_date)}</td><td>${escapeHtml(shift)}${times}</td><td><span class="status-pill ${pill.cls}">${pill.label}</span></td></tr>`;
        }).join('');

    const escalasSubview = `<div class="subview" id="colab-escalas">
<div class="table-toolbar" style="justify-content:space-between">
<div class="chip-group"><span class="chip active">Escalas do mês</span></div>
<button class="btn btn-primary btn-sm">+ Cadastrar escala</button>
</div>
<div class="table-wrap glass">
<table class="data-table">
<thead><tr><th>Colaborador</th><th>Data</th><th>Turno</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>
</div>
`;

    html = html.replace(
      /<div class="subview" id="colab-escalas">[\s\S]*?(?=<div class="subview" id="colab-organograma">)/,
      escalasSubview
    );
  }

  // ---- Colaboradores > Hierarquia da Empresa (Organograma) ----
  // Trocamos a árvore SVG-like com nomes fixos por uma árvore real construída
  // a partir de profiles.manager_id (a coluna existe no schema — confirmado
  // em supabase/migrations/0001_initial_schema.sql). Quem não tem manager_id
  // (ou cujo gestor não veio na consulta) vira raiz da árvore — pode haver
  // mais de uma raiz se o tenant não tiver um único "topo" cadastrado, o que
  // é normal em dado real (ao contrário do protótipo fixo, que sempre tinha
  // um CEO único). Os chips de filtro por departamento também passam a ser
  // gerados a partir dos departamentos que realmente aparecem entre as
  // pessoas buscadas, em vez dos 4 departamentos fixos do protótipo.
  if (orgProfiles) {
    type OrgProfile = { id: string; full_name: string; job_title: string | null; department_id: string | null; manager_id: string | null; email: string; phone: string | null };

    const deptSlugFor = (deptId: string | null): string => {
      return deptId ? `dept-${deptId}` : 'sem-departamento';
    };
    const deptLabelFor = (deptId: string | null): string => {
      return deptId ? (deptMap.get(deptId) ?? 'Sem departamento') : 'Sem departamento';
    };

    const renderOrgNode = (p: OrgProfile, childrenOf: Map<string, OrgProfile[]>, visited: Set<string>): string => {
      if (visited.has(p.id)) return ''; // proteção contra manager_id cíclico (dado malformado)
      visited.add(p.id);
      const kids = childrenOf.get(p.id) ?? [];
      const kidsHtml = kids.length ? `<ul>${kids.map((k) => renderOrgNode(k, childrenOf, visited)).join('')}</ul>` : '';
      const name = escapeHtml(p.full_name);
      const role = escapeHtml(p.job_title ?? '—');
      return `<li><div class="org-node" data-dept="${escapeHtml(deptSlugFor(p.department_id))}" data-dept-label="${escapeHtml(deptLabelFor(p.department_id))}" data-name="${name}" data-role="${role}" data-email="${escapeHtml(p.email)}" data-phone="${escapeHtml(p.phone ?? '—')}"><span class="org-avatar" style="background:linear-gradient(135deg,var(--blue),var(--blue-deep))">${escapeHtml(initials(p.full_name))}</span><div class="org-name">${name}</div><div class="org-role">${role}</div></div>${kidsHtml}</li>`;
    };

    let orgTreeHtml = `<p class="muted" style="padding:24px">Nenhum colaborador cadastrado ainda.</p>`;
    let orgChipsHtml = `<span class="chip active" data-dept="todos">Todos</span>`;

    if (orgProfiles.length > 0) {
      const byId = new Map(orgProfiles.map((p) => [p.id, p]));
      const childrenOf = new Map<string, OrgProfile[]>();
      const roots: OrgProfile[] = [];
      for (const p of orgProfiles) {
        if (p.manager_id && byId.has(p.manager_id)) {
          const list = childrenOf.get(p.manager_id) ?? [];
          list.push(p);
          childrenOf.set(p.manager_id, list);
        } else {
          roots.push(p);
        }
      }
      const visited = new Set<string>();
      orgTreeHtml = `<ul class="org-tree">${roots.map((r) => renderOrgNode(r, childrenOf, visited)).join('')}</ul>`;

      const seenDepts = new Map<string, string>();
      for (const p of orgProfiles) {
        seenDepts.set(deptSlugFor(p.department_id), deptLabelFor(p.department_id));
      }
      orgChipsHtml += Array.from(seenDepts.entries())
        .map(([slug, label]) => `<span class="chip" data-dept="${escapeHtml(slug)}">${escapeHtml(label)}</span>`)
        .join('');
    }

    const orgSubview = `<div class="subview" id="colab-organograma">
<div class="org-toolbar">
<input id="orgSearch" placeholder="Buscar por nome..." aria-label="Buscar pessoa no organograma">
<div class="chip-group" id="orgDeptFilter">${orgChipsHtml}</div>
<div class="org-zoom-controls">
<button id="orgZoomOut" type="button" aria-label="Diminuir zoom">−</button>
<button id="orgZoomReset" type="button" aria-label="Restaurar zoom">100%</button>
<button id="orgZoomIn" type="button" aria-label="Aumentar zoom">+</button>
</div>
</div>
<p class="muted" style="font-size:.78rem;margin-bottom:14px">Arraste para navegar · role o scroll para aplicar zoom · clique em uma pessoa para ver o perfil.</p>
<div class="org-viewport" id="orgViewport">
<div class="org-canvas" id="orgCanvas">
${orgTreeHtml}
</div>
</div>
</div>
      </div>
    </section>`;

    html = html.replace(
      /<div class="subview" id="colab-organograma">[\s\S]*?<\/section>/,
      orgSubview
    );
  }

  // ---- Onboarding > Documentos ----
  // A subview era 100% estática (tabela de documentos + "logs de IA/OCR" com
  // um comentário no próprio HTML avisando que era simulação). A tabela
  // `documents` já existe e já é populada de verdade pelo webhook n8n
  // (evento document_ocr_completed, em src/app/api/webhooks/n8n/route.ts),
  // então trocamos a tabela por dado real. Removemos o painel de "logs de
  // processamento IA/OCR" — não existe uma tabela de eventos/log por
  // documento no schema, só o snapshot final em ocr_status/ocr_confidence/
  // ocr_extracted, que agora aparece como uma linha auxiliar sob o status.
  if (documents) {
    const rows = documents.length === 0
      ? `<tr data-cat="todos"><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">Nenhum documento enviado ainda.</td></tr>`
      : documents.map((d) => {
          const person = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
          const candidate = Array.isArray(d.candidates) ? d.candidates[0] : d.candidates;
          const personName = person?.full_name ?? candidate?.full_name ?? '—';
          const cat = d.category ? (DOCUMENT_CATEGORY[d.category] ?? { label: d.category, filterCat: d.category }) : { label: '—', filterCat: 'outro' };
          const pill = APPROVAL_STATUS_PILL[d.approval_status ?? 'pending'] ?? APPROVAL_STATUS_PILL.pending;
          const ocrLabel = d.ocr_status ? (OCR_STATUS_LABEL[d.ocr_status] ?? d.ocr_status) : null;
          const ocrSub = ocrLabel
            ? `<div class="sub" style="margin-top:4px">OCR: ${escapeHtml(ocrLabel)}${d.ocr_confidence != null ? ' · ' + d.ocr_confidence + '%' : ''}</div>`
            : '';
          return `<tr data-cat="${escapeHtml(cat.filterCat)}"><td>${escapeHtml(d.file_name)}</td><td><span class="tag">${escapeHtml(cat.label)}</span></td><td>${escapeHtml(personName)}</td><td>${formatDate(d.created_at)}</td><td><span class="status-pill ${pill.cls}">${pill.label}</span>${ocrSub}</td></tr>`;
        }).join('');

    const documentosSubview = `<div class="subview" id="onb-documentos">
<div class="dropzone glass">
<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
<div class="t">Arraste documentos aqui ou envie pelo celular</div>
<div class="d">PDF, JPG ou PNG · até 10MB por arquivo</div>
<div class="capture-actions">
<button class="btn btn-primary btn-sm" id="btnOpenCamera" type="button">📷 Fotografar documento</button>
<button class="btn btn-ghost btn-sm" id="btnOpenGallery" type="button">🖼️ Enviar da galeria</button>
</div>
<input type="file" accept="image/*" capture="environment" id="cameraInput" style="display:none">
<input type="file" accept="image/*" id="galleryInput" style="display:none">
</div>
<div class="table-toolbar">
<input id="docsSearch" placeholder="Buscar documento ou colaborador..." aria-label="Buscar documentos">
<div class="chip-group" id="docsCatFilter">
<span class="chip active" data-cat="todos">Todos</span>
<span class="chip" data-cat="identidade">Identidade</span>
<span class="chip" data-cat="comprovantes">Comprovantes</span>
<span class="chip" data-cat="contratos">Contratos</span>
</div>
</div>
<div class="table-wrap glass">
<table class="data-table" id="docsTable">
<thead><tr><th>Documento</th><th>Categoria</th><th>Colaborador</th><th>Enviado em</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>
</div>
`;

    html = html.replace(
      /<div class="subview" id="onb-documentos">[\s\S]*?(?=<div class="subview" id="onb-treinamentos">)/,
      documentosSubview
    );
  }

  // ---- Analytics: KPIs principais ----
  // Substituímos os 4 cards do topo por números reais, calculados a partir
  // dos MESMOS dados já buscados acima (colaboradores, candidates,
  // onboardings) — por isso ficam sujeitos aos mesmos limites de paginação
  // já usados no resto da rota (ex: colaboradores é limitado a 50), assim
  // como as demais seções deste dashboard. Os widgets abaixo dos KPIs
  // (turnover mensal, ranking de crescimento por departamento, satisfação,
  // onboardings no prazo) continuam decorativos: o schema atual não guarda
  // série histórica de headcount, desligamentos (não existe tabela de
  // "terminations"/afastamentos com data) nem pesquisa de satisfação — sem
  // esse dado não dá pra calcular tendência real, só inventar número, o que
  // a tarefa pediu explicitamente pra não fazer.
  if (colaboradores && candidates && onboardings) {
    const activeHeadcount = colaboradores.filter((c) => c.status === 'active').length;

    const totalCandidatos = candidates.length;
    const aprovados = candidates.filter((c) => c.stage === 'aprovado').length;
    const conversao = totalCandidatos > 0 ? (aprovados / totalCandidatos) * 100 : null;

    const onboardingsAtivos = onboardings.length;

    const hiringDurations = candidates
      .filter((c) => c.stage === 'aprovado')
      .map((c) => (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / 86400000)
      .filter((days) => Number.isFinite(days) && days >= 0);
    const avgHiringDays = hiringDurations.length > 0
      ? Math.round(hiringDurations.reduce((a, b) => a + b, 0) / hiringDurations.length)
      : null;

    const kpiGrid = `<div class="kpi-grid" id="analyticsKpiGrid">
<div class="kpi-card glass accent-blue">
<div class="kpi-top"><span class="kpi-label">Colaboradores ativos</span><div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V9M11 19V4M18 19v-7" stroke-linecap="round"/></svg></div></div>
<div class="kpi-value">${activeHeadcount}</div>
<div class="kpi-bottom"><span class="muted" style="font-size:.78rem">Total no tenant</span></div>
</div>
<div class="kpi-card glass accent-gold">
<div class="kpi-top"><span class="kpi-label">Conversão do funil de recrutamento</span><div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
<div class="kpi-value">${conversao != null ? conversao.toFixed(1).replace('.', ',') + '%' : '—'}</div>
<div class="kpi-bottom"><span class="muted" style="font-size:.78rem">${conversao != null ? `${aprovados} de ${totalCandidatos} candidatos aprovados` : 'Sem candidaturas ainda'}</span></div>
</div>
<div class="kpi-card glass accent-blue">
<div class="kpi-top"><span class="kpi-label">Tempo médio de contratação</span><div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2" stroke-linecap="round"/></svg></div></div>
<div class="kpi-value">${avgHiringDays != null ? avgHiringDays + ' dias' : '—'}</div>
<div class="kpi-bottom"><span class="muted" style="font-size:.78rem">${avgHiringDays != null ? 'Da candidatura até aprovação' : 'Sem contratações concluídas ainda'}</span></div>
</div>
<div class="kpi-card glass accent-warn">
<div class="kpi-top"><span class="kpi-label">Onboardings em andamento</span><div class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/><circle cx="12" cy="12" r="9"/></svg></div></div>
<div class="kpi-value">${onboardingsAtivos}</div>
<div class="kpi-bottom"><span class="muted" style="font-size:.78rem">Colaboradores em integração agora</span></div>
</div>
</div>`;

    html = html.replace(
      /<div class="kpi-grid" id="analyticsKpiGrid">[\s\S]*?(?=<div class="dash-row">)/,
      `${kpiGrid}\n\n      `
    );
  }

  // ---- Configurações > Logs ----
  if (auditLogs) {
    const rows = auditLogs.length === 0
      ? `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted)">Nenhum log registrado ainda.</td></tr>`
      : auditLogs.map((a) => {
          const actor = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
          const actorName = actor?.full_name ? escapeHtml(actor.full_name) : 'Sistema';
          return `<tr><td>${actorName}</td><td>${escapeHtml(a.action)}</td><td>${formatDateTime(a.created_at)}</td><td>${escapeHtml(a.ip_address ?? '—')}</td></tr>`;
        }).join('');

    html = html.replace(
      /(<div class="subview" id="cfg-logs">\s*<div class="table-wrap glass">\s*<table class="data-table">\s*<thead><tr><th>Usuário<\/th><th>Ação<\/th><th>Data\/Hora<\/th><th>IP<\/th><\/tr><\/thead>\s*<tbody>)[\s\S]*?(<\/tbody>)/,
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
