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

const INTERVIEW_STATUS_PILL: Record<string, { cls: string; label: string }> = {
  agendada: { cls: 'info', label: 'Agendada' },
  realizada: { cls: 'ok', label: 'Realizada' },
  cancelada: { cls: 'danger', label: 'Cancelada' },
  reagendada: { cls: 'pending', label: 'Reagendada' },
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

// ────────────────────────────────────────────────────────────────────────────
// Matriz de permissões — camada VISUAL do dock lateral e das subtabs de
// Configurações.
//
// Fonte de verdade: a matriz visual que já existia em Configurações >
// Permissões (`_platform/body.ts`, subview `cfg-permissoes`, tabela
// `.access-matrix`). Ela já mostrava, por papel, "Total / Editar / Visualizar
// (Equipe|Próprio) / Sem acesso" para cada um dos 7 módulos do dock. As regras
// abaixo são essa mesma tabela transcrita 1:1 para código: qualquer badge
// diferente de "Sem acesso" = módulo aparece no dock para aquele papel;
// "Sem acesso" = módulo escondido. Roles vêm do enum real do banco
// (`profiles.role`, ver supabase/migrations/0001_initial_schema.sql:36 e
// `roleSchema` em src/lib/validation/schemas.ts:24) — não inventamos nenhum
// papel novo.
//
// Linha "Configurações" da matriz original: Admin=Total, RH/Gestor/
// Colaborador=Sem acesso. Ou seja, hoje SÓ admin deveria ver o item
// "Configurações" no dock — e isso já é consistente com o backend: a única
// ação de escrita hoje dentro de Configurações (api/onboarding, "+ Convidar
// usuário") exige `role === 'admin'` (src/app/api/onboarding/route.ts:48),
// não admin+rh como as outras APIs. Como só admin chega em Configurações,
// as 5 subtabs (Usuários/Permissões/Multiempresa/Logs/Aparência) ficam todas
// visíveis pra admin e a questão "quais subtabs cada papel vê" já fica
// resolvida por tabela — não há necessidade de uma matriz de subtab separada
// por papel enquanto nenhum não-admin entra na seção.
//
// Consistência com as demais APIs (approve/reject, onboarding-tasks,
// interviews) que já exigem role admin/rh: elas protegem AÇÕES dentro de
// Recrutamento e Onboarding, não o módulo inteiro — e a matriz visual dá
// "Visualizar" (não "Editar") pra Gestor nesses módulos, então é esperado
// que Gestor veja o módulo mas tenha botões de escrita rejeitados pela API
// (esse comportamento já existia antes desta mudança e não é afetado aqui).
type Role = 'admin' | 'rh' | 'gestor' | 'colaborador';

const DOCK_VIEW_ACCESS: Record<Role, readonly string[]> = {
  // Nível 1/4 — "Total" ou "Visualizar" em todas as linhas da matriz.
  admin: ['view-inicio', 'view-colaboradores', 'view-recrutamento', 'view-onboarding', 'view-assistente', 'view-analytics', 'view-config'],
  // Nível 2/4 — matriz dá "Editar"/"Visualizar" em tudo, "Sem acesso" só em Configurações.
  rh: ['view-inicio', 'view-colaboradores', 'view-recrutamento', 'view-onboarding', 'view-assistente', 'view-analytics'],
  // Nível 3/4 — igual RH em módulos (Visualizar/Equipe), "Sem acesso" em Configurações.
  gestor: ['view-inicio', 'view-colaboradores', 'view-recrutamento', 'view-onboarding', 'view-assistente', 'view-analytics'],
  // Nível 4/4 — matriz dá "Sem acesso" pra Recrutamento, Analytics e Configurações.
  colaborador: ['view-inicio', 'view-colaboradores', 'view-onboarding', 'view-assistente'],
};

const ALL_DOCK_VIEWS = ['view-inicio', 'view-colaboradores', 'view-recrutamento', 'view-onboarding', 'view-assistente', 'view-analytics', 'view-config'] as const;

// Subtabs de Configurações: só admin chega aqui (ver comentário acima), e a
// matriz original dá "Total" pra admin em Configurações — ou seja, todas as
// 5 subtabs continuam visíveis pra quem tem acesso ao módulo.
const CONFIG_SUBTAB_ACCESS: Record<Role, readonly string[]> = {
  admin: ['cfg-usuarios', 'cfg-permissoes', 'cfg-multiempresa', 'cfg-logs', 'cfg-aparencia'],
  rh: [],
  gestor: [],
  colaborador: [],
};

const ALL_CONFIG_SUBTABS = ['cfg-usuarios', 'cfg-permissoes', 'cfg-multiempresa', 'cfg-logs', 'cfg-aparencia'] as const;

/**
 * Remove do HTML os botões do dock (`.dock-item[data-view="..."]`) e das
 * subtabs de Configurações (`.subtab[data-sub="..."]`) que o papel do
 * usuário logado não deveria ver, conforme DOCK_VIEW_ACCESS/
 * CONFIG_SUBTAB_ACCESS acima.
 *
 * ⚠️ Isso é SÓ a camada visual (esconder do menu) — não é controle de acesso
 * real. As <section id="view-...">/<div id="cfg-..."> continuam no HTML e
 * nada impede alguém de reabrir o item via devtools ou reimplementar o
 * clique. A proteção de verdade é (e continua sendo) feita nas rotas de API
 * que já checam `profiles.role` no servidor (api/onboarding,
 * api/recrutamento/[id]/approve|reject, api/onboarding-tasks/[id],
 * api/interviews). Igual ao resto deste dashboard vanilla, que ainda não tem
 * um mecanismo de auth por papel na camada de UI — só documentamos essa
 * limitação aqui, no lugar do texto anterior que dizia que a matriz "não
 * bloqueia nada de fato".
 */
function applyRoleVisibility(fullHtml: string, role: Role): string {
  let out = fullHtml;

  const allowedViews = new Set(DOCK_VIEW_ACCESS[role]);
  for (const viewId of ALL_DOCK_VIEWS) {
    if (allowedViews.has(viewId)) continue;
    out = out.replace(
      new RegExp(`<button class="dock-item[^"]*" data-view="${viewId}"[\\s\\S]*?<\\/button>\\s*`),
      ''
    );
  }

  const allowedSubtabs = new Set(CONFIG_SUBTAB_ACCESS[role]);
  for (const subId of ALL_CONFIG_SUBTABS) {
    if (allowedSubtabs.has(subId)) continue;
    out = out.replace(
      new RegExp(`<button class="subtab[^"]*" data-sub="${subId}">[^<]*<\\/button>\\s*`),
      ''
    );
  }

  return out;
}

export async function GET() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  let html = `<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<script>(function(){try{var t=localStorage.getItem('fortixx-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
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
<script src="/tesseract/tesseract.min.js"></script>
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
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) {
    return new NextResponse(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const role = (profile?.role ?? 'colaborador') as Role;

  // Injeta o tenant_id do usuário logado no <body>, pro script.ts poder mandar
  // como existing_tenant_id ao chamar api/onboarding (ver comentário no topo).
  html = html.replace('<body>', `<body data-tenant-id="${escapeHtml(tenantId)}">`);

  // Camada visual da matriz de permissões (dock + subtabs de Configurações).
  // Ver comentário em applyRoleVisibility/DOCK_VIEW_ACCESS acima.
  html = applyRoleVisibility(html, role);

  // Atualiza o parágrafo de Configurações > Permissões pra refletir a nova
  // realidade: a matriz agora corresponde ao que de fato some do dock/subtabs
  // para cada papel (não é mais "só visual, sem efeito nenhum").
  html = html.replace(
    'Esta matriz é a estrutura visual de permissões da Fortixx — pronta para guiar a implementação real de autenticação por papel. Hoje ela não bloqueia nada de fato: qualquer pessoa que abrir este arquivo navega por todos os módulos, independente do papel mostrado aqui.',
    'Esta matriz reflete o que hoje é escondido do menu lateral e das abas de Configurações para cada papel (dock e subtabs, calculado a partir de profiles.role no servidor). É uma proteção visual, não uma barreira real: quem forçar a URL/API de um módulo escondido esbarra na checagem de role feita nas rotas de API (quando ela existe) — nem toda ação tem essa checagem hoje.'
  );

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
    { data: interviews },
    { data: trainings },
    { data: trainingProgress },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, job_title, department_id, status, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
    supabase.from('departments').select('id, name').eq('tenant_id', tenantId),
    supabase.from('job_openings').select('id, title, department_id, location, employment_type, status').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(30),
    supabase.from('candidates').select('id, full_name, job_opening_id, stage, created_at, updated_at, extracted_skills').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100),
    supabase.from('onboardings').select('id, profile_id, status, start_date, profiles(full_name, job_title)').eq('tenant_id', tenantId).eq('status', 'em_andamento').limit(20),
    // profiles:profile_id — schedules tem 2 FKs pra profiles (profile_id e
    // created_by), então o embed precisa dizer qual. Sem isso o PostgREST
    // devolve erro e a seção Escalas fica com o HTML de demonstração.
    supabase.from('schedules').select('id, profile_id, shift_date, shift_type, start_time, end_time, status, profiles:profile_id(full_name)').eq('tenant_id', tenantId).gte('shift_date', monthStart).lte('shift_date', monthEnd).order('shift_date', { ascending: true }).limit(200),
    supabase.from('audit_logs').select('id, actor_id, action, entity_type, ip_address, created_at, profiles(full_name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
    // Colaboradores > Hierarquia da Empresa: precisa de manager_id/email/phone,
    // que a query de "colaboradores" acima não busca (e é limitada a 50, mas
    // aqui buscamos mais pra árvore ficar mais completa).
    supabase.from('profiles').select('id, full_name, job_title, department_id, manager_id, email, phone').eq('tenant_id', tenantId).order('full_name', { ascending: true }).limit(300),
    // Onboarding > Documentos: tabela real, já populada pelo webhook n8n
    // (document_ocr_completed) em api/webhooks/n8n/route.ts.
    supabase.from('documents').select('id, file_name, category, ocr_status, ocr_confidence, approval_status, created_at, profiles:profile_id(full_name), candidates:candidate_id(full_name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100),
    // Recrutamento > Entrevistas: tabela real (supabase/migrations/0009_interviews.sql).
    supabase.from('interviews').select('id, scheduled_at, status, notes, candidates(full_name), job_openings(title), profiles:interviewer_id(full_name)').eq('tenant_id', tenantId).order('scheduled_at', { ascending: true }).limit(100),
    // Onboarding > Treinamentos: catálogo real (supabase/migrations/0010_trainings.sql).
    supabase.from('trainings').select('id, title, description, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
    supabase.from('training_progress').select('training_id, profile_id, progress_pct').eq('tenant_id', tenantId),
  ]) as unknown as [
    { data: { id: string; full_name: string; job_title: string | null; department_id: string | null; status: string; created_at: string }[] | null },
    { data: { id: string; name: string }[] | null },
    { data: { id: string; title: string; department_id: string | null; location: string | null; employment_type: string; status: string }[] | null },
    { data: { id: string; full_name: string; job_opening_id: string | null; stage: string; created_at: string; updated_at: string; extracted_skills: string[] | null }[] | null },
    { data: { id: string; profile_id: string; status: string; start_date: string; profiles: { full_name: string; job_title: string | null } | { full_name: string; job_title: string | null }[] | null }[] | null },
    { data: { id: string; profile_id: string; shift_date: string; shift_type: string; start_time: string | null; end_time: string | null; status: string; profiles: { full_name: string } | { full_name: string }[] | null }[] | null },
    { data: { id: string; actor_id: string | null; action: string; entity_type: string | null; ip_address: string | null; created_at: string; profiles: { full_name: string } | { full_name: string }[] | null }[] | null },
    { data: { id: string; full_name: string; job_title: string | null; department_id: string | null; manager_id: string | null; email: string; phone: string | null }[] | null },
    { data: { id: string; file_name: string; category: string | null; ocr_status: string | null; ocr_confidence: number | null; approval_status: string | null; created_at: string; profiles: { full_name: string } | { full_name: string }[] | null; candidates: { full_name: string } | { full_name: string }[] | null }[] | null },
    { data: { id: string; scheduled_at: string; status: string; notes: string | null; candidates: { full_name: string } | { full_name: string }[] | null; job_openings: { title: string } | { title: string }[] | null; profiles: { full_name: string } | { full_name: string }[] | null }[] | null },
    { data: { id: string; title: string; description: string | null; created_at: string }[] | null },
    { data: { training_id: string; profile_id: string; progress_pct: number }[] | null },
  ];

  // Segunda leva de consultas — dados que só as seções "Início", "Analytics" e
  // "Configurações > Multiempresa" usam. Fica num Promise.all separado pra não
  // mexer na tupla tipada grande acima; mesmo padrão de tenant-scoping.
  const [
    { data: headcount },
    { data: tenantRow },
  ] = await Promise.all([
    // Crescimento do quadro / donut por área / ranking por depto: precisa de
    // TODOS os colaboradores (não só os 50 mais recentes) com data de entrada,
    // status e departamento. Nada de PII aqui além do que já é exposto.
    supabase.from('profiles').select('created_at, status, department_id').eq('tenant_id', tenantId).order('created_at', { ascending: true }).limit(2000),
    supabase.from('tenants').select('name, plan, created_at').eq('id', tenantId).single(),
  ]) as unknown as [
    { data: { created_at: string; status: string; department_id: string | null }[] | null },
    { data: { name: string; plan: string; created_at: string } | null },
  ];

  const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const jobMap = new Map((jobOpenings ?? []).map((j) => [j.id, j.title]));

  // Série de headcount acumulado nos últimos `months` meses, a partir das datas
  // de entrada (profiles.created_at). É headcount BRUTO acumulado (não desconta
  // desligamentos) porque o schema não guarda data de desligamento — o número
  // de cada mês é "quantas pessoas já tinham entrado até o fim daquele mês".
  function monthlyHeadcount(rows: { created_at: string }[], months: number): { label: string; value: number }[] {
    const now = new Date();
    const series: { label: string; value: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // último dia do mês
      const count = rows.filter((r) => new Date(r.created_at) <= ref).length;
      series.push({ label: ref.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), value: count });
    }
    return series;
  }

  // Constrói o `d=` de um <path> suave (Catmull-Rom → Bézier) a partir de uma
  // série de valores, no viewBox 600x180 usado pelos SVGs do protótipo.
  function sparkPath(values: number[], w = 600, h = 180, pad = 12): { line: string; area: string } {
    if (values.length === 0) return { line: '', area: '' };
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
    const pts = values.map((v, i) => [pad + i * stepX, h - pad - ((v - min) / span) * (h - pad * 2)] as const);
    let line = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      line += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
    return { line, area };
  }

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
      `<div class="subview active" id="recrut-vagas">\n<div class="table-toolbar" style="justify-content:flex-end"><button class="btn btn-primary btn-sm" id="btnNewJob">+ Nova vaga</button></div>\n<div class="dash-row thirds">${cards}</div>\n</div>\n`
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

  // ---- Recrutamento > Entrevistas ----
  // Era tabela 100% estática. Agora lê a tabela `interviews` real (0009).
  // O botão "+ Agendar entrevista" segue o mesmo padrão simples de prompt()
  // usado em Configurações > Usuários ("+ Convidar usuário") — os dados de
  // candidatos/entrevistadores do tenant ficam num bloco data-* escondido
  // pro script.ts resolver nome -> id sem precisar de outro fetch.
  if (interviews) {
    const rows = interviews.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">Nenhuma entrevista agendada ainda.</td></tr>`
      : interviews.map((i) => {
          const candidate = Array.isArray(i.candidates) ? i.candidates[0] : i.candidates;
          const job = Array.isArray(i.job_openings) ? i.job_openings[0] : i.job_openings;
          const interviewer = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles;
          const pill = INTERVIEW_STATUS_PILL[i.status] ?? INTERVIEW_STATUS_PILL.agendada;
          return `<tr><td>${escapeHtml(candidate?.full_name ?? '—')}</td><td>${escapeHtml(job?.title ?? '—')}</td><td>${formatDateTime(i.scheduled_at)}</td><td>${escapeHtml(interviewer?.full_name ?? '—')}</td><td><span class="status-pill ${pill.cls}">${pill.label}</span></td></tr>`;
        }).join('');

    const candidatesMeta = escapeHtml(JSON.stringify((candidates ?? []).map((c) => ({ id: c.id, full_name: c.full_name }))));
    const interviewersMeta = escapeHtml(JSON.stringify((colaboradores ?? []).map((c) => ({ id: c.id, full_name: c.full_name }))));

    const entrevistasSubview = `<div class="subview" id="recrut-entrevistas">
<div class="table-toolbar" style="justify-content:space-between">
<div class="chip-group"><span class="chip active">Entrevistas agendadas</span></div>
<button class="btn btn-primary btn-sm" id="btnScheduleInterview">+ Agendar entrevista</button>
</div>
<div class="table-wrap glass">
<table class="data-table">
<thead><tr><th>Candidato</th><th>Vaga</th><th>Data/Hora</th><th>Entrevistador</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>
<div id="interviewSchedulerMeta" data-candidates="${candidatesMeta}" data-interviewers="${interviewersMeta}" style="display:none"></div>
</div>
`;

    html = html.replace(
      /<div class="subview" id="recrut-entrevistas">[\s\S]*?(?=<div class="subview" id="recrut-aprovacoes">)/,
      entrevistasSubview
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
          const skills = Array.isArray(c.extracted_skills) ? c.extracted_skills.slice(0, 6) : [];
          const tags = skills.length
            ? skills.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join('')
            : '<span class="muted" style="font-size:.78rem">—</span>';
          return `<tr><td>${escapeHtml(c.full_name)}</td><td>${escapeHtml(jobTitle)}</td><td><div class="tags">${tags}</div></td><td>${formatDate(c.created_at)}</td></tr>`;
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

    const peopleMeta = escapeHtml(JSON.stringify((colaboradores ?? []).map((c) => ({ id: c.id, full_name: c.full_name }))));
    const escalasSubview = `<div class="subview" id="colab-escalas">
<div class="table-toolbar" style="justify-content:space-between">
<div class="chip-group"><span class="chip active">Escalas do mês</span></div>
<button class="btn btn-primary btn-sm" id="btnNewSchedule" data-people="${peopleMeta}">+ Cadastrar escala</button>
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

  // ---- Onboarding > Treinamentos ----
  // Era 3 cards de progresso fixos. Agora lê `trainings` (catálogo) +
  // `training_progress` (0010_trainings.sql) e mostra quantos colaboradores
  // completaram cada treinamento. Criar treinamento não faz parte desta
  // passada — só leitura + o endpoint de progresso (api/trainings/progress).
  if (trainings) {
    let treinamentosBody: string;
    if (trainings.length === 0) {
      treinamentosBody = `<p class="muted" style="padding:24px">Nenhum treinamento cadastrado — crie um pra começar.</p>`;
    } else {
      const cards = trainings.map((t) => {
        const rows = (trainingProgress ?? []).filter((p) => p.training_id === t.id);
        const total = rows.length;
        const completos = rows.filter((p) => p.progress_pct >= 100).length;
        const pct = total > 0 ? Math.round(rows.reduce((sum, p) => sum + p.progress_pct, 0) / total) : 0;
        const sub = total > 0 ? `${completos} de ${total} colaboradores completaram` : 'Nenhum colaborador iniciou ainda';
        return `<div class="panel glass"><h3 style="font-family:var(--font-display);font-weight:600;margin-bottom:12px">${escapeHtml(t.title)}</h3><div class="progress-row"><span>${escapeHtml(sub)}</span><span>${pct}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div>`;
      }).join('');
      treinamentosBody = `<div class="dash-row thirds">${cards}</div>`;
    }

    html = html.replace(
      /<div class="subview" id="onb-treinamentos">[\s\S]*?(?=<div class="subview" id="onb-status">)/,
      `<div class="subview" id="onb-treinamentos"><div class="table-toolbar" style="justify-content:flex-end"><button class="btn btn-primary btn-sm" id="btnNewTraining">+ Novo treinamento</button></div>${treinamentosBody}</div>\n`
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

  // ---- Início: KPIs, gráfico de crescimento, donut por área, feeds ----
  // Antes: números e listas fixos ("1.248", "Pedro Lima", etc). Agora tudo sai
  // dos dados reais do tenant. O gráfico "Crescimento do quadro" é headcount
  // BRUTO acumulado por mês (não desconta desligamento — o schema não guarda
  // data de saída), então é sempre monotônico crescente: mostra "quantas
  // pessoas já tinham entrado até o fim de cada mês".
  if (headcount) {
    const totalHeadcount = headcount.length;
    const activeOnboardings = (onboardings ?? []).length;
    const openJobs = (jobOpenings ?? []).filter((j) => j.status === 'open').length;
    // "Solicitações pendentes" = documentos aguardando aprovação (mesma
    // definição do KPI em src/app/dashboard/page.tsx, que é a fonte dos
    // números dos 4 cards do topo via query param do iframe — não replicar
    // isso aqui pra não conflitar).
    const pendingDocs = (documents ?? []).filter((d) => (d.approval_status ?? 'pending') === 'pending');
    const hires30 = headcount.filter((h) => Date.now() - new Date(h.created_at).getTime() <= 30 * 86400000).length;
    const fmt = (n: number) => n.toLocaleString('pt-BR');

    // Só os textos de "delta" abaixo dos 4 KPIs — os valores dos KPIs vêm do
    // page.tsx (query param -> script.ts setText), não daqui.
    html = html
      .replace('↑ 4,2% nos últimos 30 dias', hires30 > 0 ? `↑ ${hires30} ${hires30 === 1 ? 'contratação' : 'contratações'} em 30 dias` : 'sem novas contratações em 30 dias')
      .replace('↑ 2 esta semana', `${openJobs} ${openJobs === 1 ? 'aberta agora' : 'abertas agora'}`)
      .replace('→ estável', `${activeOnboardings} em andamento`)
      .replace('3 vencem hoje', pendingDocs.length > 0 ? `${pendingDocs.length} aguardando aprovação` : 'nada pendente');

    // Gráfico "Crescimento do quadro" (Início) — 12 meses.
    const series = monthlyHeadcount(headcount, 12);
    const { line, area } = sparkPath(series.map((s) => s.value));
    if (line) {
      html = html
        .replace(/(<path class="area" d=")[^"]*(")/, `$1${area}$2`)
        .replace(/(<path class="line-glow" id="dashGlowLine" d=")[^"]*(")/, `$1${line}$2`)
        .replace(/(<path class="line" id="dashCrispLine" d=")[^"]*(")/, `$1${line}$2`);
    }

    // Donut "Colaboradores por área" (Início).
    const byDept = new Map<string, number>();
    for (const h of headcount) {
      const label = h.department_id ? (deptMap.get(h.department_id) ?? 'Sem área') : 'Sem área';
      byDept.set(label, (byDept.get(label) ?? 0) + 1);
    }
    const deptSorted = Array.from(byDept.entries()).sort((a, b) => b[1] - a[1]);
    const donutColors = ['var(--blue)', 'var(--blue-light)', 'var(--gold)'];
    const legend: { label: string; count: number; style: string }[] = deptSorted.slice(0, 3).map((entry, i) => ({
      label: entry[0], count: entry[1], style: `background:${donutColors[i]}`,
    }));
    const restCount = deptSorted.slice(3).reduce((sum, [, n]) => sum + n, 0);
    if (restCount > 0) legend.push({ label: 'Outras', count: restCount, style: 'background:var(--surface-strong);border:1px solid var(--border)' });
    const donutLegend = legend.length === 0
      ? '<li class="muted">Nenhum colaborador cadastrado ainda</li>'
      : legend.map((e) => {
          const pct = totalHeadcount > 0 ? Math.round((e.count / totalHeadcount) * 100) : 0;
          return `<li><span class="dot" style="${e.style}"></span>${escapeHtml(e.label)} — ${pct}%</li>`;
        }).join('');
    html = html.replace(
      /(<div class="donut"><span class="donut-center-label">)[^<]*(<\/span><\/div>\s*<ul class="donut-legend">)[\s\S]*?(<\/ul>)/,
      `$1${fmt(totalHeadcount)}$2${donutLegend}$3`
    );

    // Painel "Solicitações pendentes" (Início) — documentos aguardando aprovação
    // (mesma definição do KPI). O regex termina em </div></div> (fim da
    // .mini-list + do .panel) pra não deixar linhas de demonstração pra trás.
    const DOC_CAT_LABEL: Record<string, string> = { identidade: 'Identidade', comprovante: 'Comprovante', contrato: 'Contrato', curriculo: 'Currículo', outro: 'Documento' };
    const notifRows = pendingDocs.length === 0
      ? '<div class="mini-row"><span class="muted">Nada pendente.</span></div>'
      : pendingDocs.slice(0, 6).map((d) => {
          const person = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
          const cand = Array.isArray(d.candidates) ? d.candidates[0] : d.candidates;
          const who = person?.full_name ?? cand?.full_name ?? '';
          const label = d.category ? (DOC_CAT_LABEL[d.category] ?? 'Documento') : 'Documento';
          return `<div class="mini-row"><span>${escapeHtml(label)}${who ? ' — ' + escapeHtml(who) : ''}</span><span class="status-pill pending">Aguardando</span></div>`;
        }).join('');
    html = html.replace(
      /(<h3>Solicitações pendentes<\/h3><\/div>\s*<div class="mini-list">)[\s\S]*?<\/div>\s*<\/div>/,
      `$1${notifRows}</div>`
    );

    // Painel "Atividade recente" (Início) — audit_logs.
    const feedRows = (auditLogs ?? []).length === 0
      ? '<div class="feed-row"><span class="feed-dot"></span>Nenhuma atividade registrada ainda</div>'
      : (auditLogs ?? []).slice(0, 7).map((a) => {
          const actor = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
          const who = actor?.full_name ? escapeHtml(actor.full_name) : 'Sistema';
          const time = new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return `<div class="feed-row"><span class="feed-dot"></span>${who} — ${escapeHtml(a.action)}<span class="feed-time">${time}</span></div>`;
        }).join('');
    html = html.replace(
      /(<h3>Atividade recente<\/h3><\/div>\s*<div class="feed-list">)[\s\S]*?<\/div>\s*<\/div>/,
      `$1${feedRows}</div>`
    );
  }

  // ---- Analytics: gráfico de crescimento, ranking por depto, insights ----
  // Os 4 KPIs do topo já são reais (bloco "Analytics: KPIs principais" acima).
  // Aqui tratamos o resto da view: gráfico de linha, turnover (sem dado — estado
  // honesto), ranking de crescimento por departamento (real, janela de 90 dias)
  // e os insights automáticos (derivados dos números reais).
  if (headcount) {
    const series12 = monthlyHeadcount(headcount, 12);
    const { line, area } = sparkPath(series12.map((s) => s.value));
    if (line) {
      html = html
        .replace(/(<path fill="url\(#lineGradAnalytics\)" d=")[^"]*(")/, `$1${area}$2`)
        .replace(/(<path class="line-compare" id="analyticsCompareLine" d=")[^"]*(")/, `$1${line}$2`)
        .replace(/(<path class="line-glow" id="analyticsGlowLine" d=")[^"]*(")/, `$1${line}$2`)
        .replace(/(<path class="line" id="analyticsCrispLine" d=")[^"]*(")/, `$1${line}$2`);
    }

    // Turnover: sem tabela de desligamento no schema — estado honesto.
    html = html.replace(
      /(<h3>Turnover mensal<\/h3><\/div>\s*)<div class="bars analytics-bars in-view" id="turnoverBars">[\s\S]*?<\/div>\s*<div class="chart-tooltip" id="turnoverTooltip"><\/div>/,
      `$1<p class="muted" style="padding:24px;font-size:.84rem">Sem dados de desligamento no período. O schema ainda não registra data de saída — quando registrar, o turnover mensal aparece aqui.</p>`
    );

    // Ranking "Crescimento por departamento" — headcount agora vs. 90 dias atrás.
    const cutoff90 = Date.now() - 90 * 86400000;
    const deptNow = new Map<string, number>();
    const deptThen = new Map<string, number>();
    for (const h of headcount) {
      const key = h.department_id ?? 'sem';
      deptNow.set(key, (deptNow.get(key) ?? 0) + 1);
      if (new Date(h.created_at).getTime() < cutoff90) deptThen.set(key, (deptThen.get(key) ?? 0) + 1);
    }
    const deptRows = Array.from(deptNow.entries()).map(([key, now]) => {
      const then = deptThen.get(key) ?? 0;
      const pct = then > 0 ? Math.round(((now - then) / then) * 100) : (now > 0 ? 100 : 0);
      const name = key === 'sem' ? 'Sem área' : (deptMap.get(key) ?? 'Sem área');
      return { name, pct };
    }).sort((a, b) => b.pct - a.pct).slice(0, 6);
    const maxPct = Math.max(...deptRows.map((r) => Math.abs(r.pct)), 1);
    const deptRankHtml = deptRows.length === 0
      ? '<p class="muted" style="padding:16px">Nenhum departamento com colaboradores ainda.</p>'
      : deptRows.map((r, i) =>
          `<div class="dept-rank-row"><span class="dept-rank-name">${escapeHtml(r.name)}</span><div class="dept-rank-bar-wrap"><div class="dept-rank-bar" style="width:${Math.round((Math.abs(r.pct) / maxPct) * 100)}%${i === 0 ? ';background:var(--gold)' : ''}"></div></div><span class="dept-rank-value">${r.pct >= 0 ? '+' : ''}${r.pct}%</span></div>`
        ).join('');
    html = html.replace(
      /<div class="dept-rank">[\s\S]*?<\/div>\s*<\/div>\s*(?=<div class="panel glass insights-panel">)/,
      `<div class="dept-rank">${deptRankHtml}</div>\n        </div>\n        `
    );

    // Insights automáticos — só afirmações que os dados reais sustentam.
    const insights: string[] = [];
    if (deptRows.length > 0 && deptRows[0].pct > 0) {
      insights.push(`<li><span class="insight-icon up">↑</span><span>${escapeHtml(deptRows[0].name)} foi o departamento que mais cresceu nos últimos 90 dias (${deptRows[0].pct >= 0 ? '+' : ''}${deptRows[0].pct}%).</span></li>`);
    }
    const hires30count = headcount.filter((h) => Date.now() - new Date(h.created_at).getTime() <= 30 * 86400000).length;
    insights.push(`<li><span class="insight-icon up">↑</span><span>${hires30count} ${hires30count === 1 ? 'pessoa entrou' : 'pessoas entraram'} nos últimos 30 dias.</span></li>`);
    const activeOnboardings = (onboardings ?? []).length;
    if (activeOnboardings > 0) {
      insights.push(`<li><span class="insight-icon warn">!</span><span>${activeOnboardings} ${activeOnboardings === 1 ? 'colaborador está' : 'colaboradores estão'} em onboarding agora — acompanhe o checklist.</span></li>`);
    }
    insights.push('<li><span class="insight-icon warn">!</span><span>Turnover e satisfação ainda não têm fonte de dado no sistema — os widgets ficam vazios de propósito.</span></li>');
    html = html.replace(
      /(<h3>Insights automáticos<\/h3><\/div>\s*<ul class="insights-list">)[\s\S]*?(<\/ul>)/,
      `$1${insights.join('')}$2`
    );

    // Linha de baixo (thirds): Satisfação e Onboardings no prazo não têm dado —
    // trocamos o donut decorativo por um estado honesto; Tempo médio reaproveita
    // o cálculo real de dias da candidatura à aprovação.
    html = html.replace(
      /(<h3>Satisfação<\/h3><\/div>)<div class="donut-wrap" style="justify-content:center"><div class="donut" data-target="92"[\s\S]*?<\/div><\/div>/,
      `$1<p class="muted" style="padding:24px;font-size:.84rem">Sem pesquisa de satisfação cadastrada ainda.</p>`
    );
    html = html.replace(
      /(<h3>Onboardings no prazo<\/h3><\/div>)<div class="donut-wrap" style="justify-content:center"><div class="donut" data-target="96"[\s\S]*?<\/div><\/div>/,
      `$1<p style="text-align:center;margin-top:20px;font-family:var(--font-mono);font-weight:700;font-size:2.1rem">${(onboardings ?? []).length}</p><p class="muted" style="text-align:center;font-size:.78rem">em andamento agora</p>`
    );
    const approvedCands = (candidates ?? []).filter((c) => c.stage === 'aprovado');
    const durations = approvedCands
      .map((c) => (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / 86400000)
      .filter((d) => Number.isFinite(d) && d >= 0);
    const avgDays = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
    html = html.replace(
      /(<h3>Tempo médio de contratação<\/h3><\/div>)<p style="text-align:center;margin-top:20px;[^"]*font-size:2\.1rem">[^<]*<\/p><p class="muted" style="text-align:center;font-size:\.78rem">[^<]*<\/p>/,
      `$1<p style="text-align:center;margin-top:20px;font-family:var(--font-mono);font-weight:700;font-size:2.1rem">${avgDays != null ? avgDays + ' dias' : '—'}</p><p class="muted" style="text-align:center;font-size:.78rem">${avgDays != null ? 'da candidatura à aprovação' : 'sem contratações concluídas'}</p>`
    );
  }

  // ---- Configurações > Multiempresa ----
  // Era 3 cards fixos (Matriz/Curitiba/Recife). Multiempresa real (matriz +
  // filiais no mesmo painel) não existe: cada empresa é um tenant isolado. Então
  // mostramos só a empresa atual, com dado real, e explicamos o resto.
  {
    const companyName = escapeHtml(tenantRow?.name ?? 'Minha empresa');
    const plan = escapeHtml(tenantRow?.plan ?? '—');
    const count = (headcount ?? []).length;
    const companyIcon = '<div class="company-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/></svg></div>';
    html = html.replace(
      /<div class="company-grid">[\s\S]*?<\/div>\s*<\/div>\s*(?=<div class="subview")/,
      `<div class="company-grid">
<div class="company-card glass">
<span class="badge-active">● EMPRESA ATIVA</span>
${companyIcon}
<h4>${companyName}</h4><div class="loc">Plano ${plan}</div>
<div class="count">${count} ${count === 1 ? 'colaborador' : 'colaboradores'}</div>
</div>
</div>
<p class="muted" style="font-size:.8rem;margin-top:14px">Multiempresa (matriz + filiais no mesmo painel) ainda não está ativo — hoje cada empresa é um tenant isolado. Quando for habilitado, as outras empresas aparecem aqui.</p>
</div>
`
    );
  }

  // ---- Assistente RH (view "view-assistente") ----
  // As 4 subtabs eram 100% estáticas. Agora leem hr_faqs / hr_conversations
  // (supabase/migrations/0011_hr_assistant.sql). Enquanto a migration não
  // rodar, as queries voltam null e cada subtab mantém o conteúdo de
  // demonstração — mesmo padrão `if (data)` do resto da rota.
  //
  // O assistente FUNCIONA sem chave nenhuma: casa a pergunta com a base de
  // FAQ do tenant (src/lib/hr-assistant/responder.ts). `aiUpgrade` só indica
  // se o modo IA (Claude API) está ativo por cima disso — é informativo.
  const aiUpgrade = !!process.env.ANTHROPIC_API_KEY;

  const [{ data: hrFaqs }, { data: hrConversations }] = await Promise.all([
    supabase.from('hr_faqs').select('question, answer, views').eq('tenant_id', tenantId).order('views', { ascending: false }).limit(30),
    supabase.from('hr_conversations').select('id, subject, status, last_message_at, profiles:profile_id(full_name)').eq('tenant_id', tenantId).order('last_message_at', { ascending: false }).limit(50),
  ]) as unknown as [
    { data: { question: string; answer: string; views: number }[] | null },
    { data: { id: string; subject: string; status: string; last_message_at: string; profiles: { full_name: string } | { full_name: string }[] | null }[] | null },
  ];

  const HR_CONV_PILL: Record<string, { cls: string; label: string }> = {
    open: { cls: 'info', label: 'Em aberto' },
    resolved: { cls: 'ok', label: 'Resolvido' },
    escalated: { cls: 'danger', label: 'Escalado para RH' },
  };
  const convPerson = (c: { profiles: { full_name: string } | { full_name: string }[] | null }): string => {
    const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return p?.full_name ? escapeHtml(p.full_name) : 'Colaborador';
  };

  html = html.replace(
    '88% das dúvidas resolvidas automaticamente nos últimos 30 dias.',
    aiUpgrade
      ? 'Tire dúvidas de RH — o assistente responde pela base de conhecimento (com IA da Claude).'
      : 'Tire dúvidas de RH — o assistente responde pela base de conhecimento da empresa.'
  );

  // ---- Assistente RH > FAQ inteligente ----
  if (hrFaqs) {
    const cards = hrFaqs.length === 0
      ? '<p class="muted" style="padding:24px">Nenhuma pergunta na base de conhecimento ainda. Adicione FAQs pra o assistente responder por elas.</p>'
      : hrFaqs.map((f) =>
          `<div class="panel glass"><h3 style="font-family:var(--font-display);font-weight:600;margin-bottom:8px">${escapeHtml(f.question)}</h3><p class="muted" style="font-size:.84rem">${escapeHtml(f.answer)}</p><div class="muted" style="font-size:.72rem;margin-top:10px">${f.views} ${f.views === 1 ? 'visualização' : 'visualizações'}</div></div>`
        ).join('');
    html = html.replace(
      /(<div class="subview" id="ast-faq">\s*)<div class="dash-row thirds">[\s\S]*?<\/div>\s*<\/div>\s*(?=<div class="subview" id="ast-historico">)/,
      `$1<div class="table-toolbar" style="justify-content:flex-end;margin-bottom:14px"><button class="btn btn-primary btn-sm" id="btnNewFaq">+ Nova pergunta</button></div><div class="dash-row thirds">${cards}</div>\n        </div>\n        `
    );
  }

  // ---- Assistente RH > Histórico ----
  if (hrConversations) {
    const rows = hrConversations.length === 0
      ? '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted)">Nenhum atendimento registrado ainda.</td></tr>'
      : hrConversations.map((c) => {
          const pill = HR_CONV_PILL[c.status] ?? HR_CONV_PILL.open;
          return `<tr><td>${convPerson(c)}</td><td>${escapeHtml(c.subject)}</td><td>${formatDate(c.last_message_at)}</td><td><span class="status-pill ${pill.cls}">${pill.label}</span></td></tr>`;
        }).join('');
    html = html.replace(
      /(<div class="subview" id="ast-historico">\s*<div class="table-wrap glass">\s*<table class="data-table">\s*<thead><tr><th>Colaborador<\/th><th>Assunto<\/th><th>Data<\/th><th>Status<\/th><\/tr><\/thead>\s*<tbody>)[\s\S]*?(<\/tbody>)/,
      `$1${rows}$2`
    );

    // ---- Assistente RH > Escalonamento ----
    const escalated = hrConversations.filter((c) => c.status === 'escalated');
    const items = escalated.length === 0
      ? '<p class="muted" style="padding:24px">Nenhum atendimento escalado no momento.</p>'
      : escalated.map((c) =>
          `<div class="approval-item glass" data-conversation-id="${escapeHtml(c.id)}"><div class="approval-info"><div class="t">${convPerson(c)} — ${escapeHtml(c.subject)}</div><div class="d">Escalado em ${formatDate(c.last_message_at)}</div></div><div class="approval-actions"><span class="status-pill danger">Escalado</span><button class="btn btn-primary btn-sm btn-hr-resolve">Marcar resolvido</button></div></div>`
        ).join('');
    html = html.replace(
      /(<div class="subview" id="ast-escalonamento">)[\s\S]*?(<\/section>)(?=\s*<!--[^>]*ANALYTICS)/,
      `$1${items}\n        </div>\n      </div>\n    $2`
    );

    // ---- Assistente RH > Atendimento (chat) ----
    let hrMessages: { role: string; body: string }[] | null = null;
    if (hrConversations.length > 0) {
      const { data } = await supabase
        .from('hr_messages')
        .select('role, body')
        .eq('conversation_id', hrConversations[0].id)
        .order('created_at', { ascending: true })
        .limit(50);
      hrMessages = (data as { role: string; body: string }[] | null) ?? [];
    }

    // O chat sempre funciona (modo FAQ no mínimo). O atributo fica '1'; o
    // script.ts continua lendo ele, então mantemos por compatibilidade.
    html = html.replace('<div class="chat-layout">', '<div class="chat-layout" data-assistant-enabled="1">');

    const listItems = hrConversations.length === 0
      ? '<div class="chat-list-item"><div class="n">Sem conversas ainda</div><div class="m">As perguntas dos colaboradores aparecem aqui</div></div>'
      : hrConversations.map((c, i) =>
          `<div class="chat-list-item${i === 0 ? ' active' : ''}" data-conversation-id="${escapeHtml(c.id)}"><div class="n">${convPerson(c)}</div><div class="m">${escapeHtml(c.subject)}</div></div>`
        ).join('');
    html = html.replace(
      /(<div class="chat-list glass">)[\s\S]*?(<\/div>)(?=\s*<div class="chat-panel glass">)/,
      `$1${listItems}$2`
    );

    const bubbles = (hrMessages && hrMessages.length > 0)
      ? hrMessages.map((m) => `<div class="chat-bubble ${m.role === 'user' ? 'user' : 'bot'}">${escapeHtml(m.body)}</div>`).join('')
      : '<div class="chat-bubble bot">Oi! Sou o assistente de RH. Pergunte sobre férias, holerite, ponto ou benefícios.</div>';
    html = html.replace(
      /(<div class="chat-log" id="chatLog">)[\s\S]*?(<\/div>)(?=\s*<div class="chat-input-row">)/,
      `$1${bubbles}$2`
    );

    const headName = hrConversations.length > 0 ? convPerson(hrConversations[0]) : 'Assistente RH';
    html = html.replace(
      '<strong>Pedro Lima</strong><span class="status-pill ok">Resolvido pelo bot</span>',
      `<strong>${headName}</strong><span class="status-pill ${aiUpgrade ? 'ok' : 'info'}">${aiUpgrade ? 'IA ativa' : 'Modo FAQ'}</span>`
    );
  }

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
