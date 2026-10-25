import { z } from 'zod';

/**
 * Schemas Zod centralizados — validação de input na borda das API routes.
 *
 * Cada schema retorna um erro genérico "Dados inválidos." na camada HTTP
 * (não vaza qual campo falhou). Detalhes ficam em `parsed.error` pra log
 * server-side.
 */

// ────────────────────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('e-mail inválido').max(254).toLowerCase().trim(),
  password: z.string().min(1, 'senha obrigatória').max(200, 'senha longa demais'),
});

// ────────────────────────────────────────────────────────────────────────────
// Onboarding (admin cria user+tenant via RPC)
// ────────────────────────────────────────────────────────────────────────────

export const roleSchema = z.enum(['admin', 'rh', 'gestor', 'colaborador']);

export const onboardingSchema = z.object({
  email: z.string().email().max(254).toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'senha deve ter ≥ 8 caracteres')
    .max(200),
  full_name: z.string().min(2).max(120).trim(),
  company_name: z.string().max(120).trim().optional().or(z.literal('')),
  existing_tenant_id: z
    .string()
    .uuid()
    .nullable()
    .optional(),
  role: roleSchema,
});

// ────────────────────────────────────────────────────────────────────────────
// Recrutamento
// ────────────────────────────────────────────────────────────────────────────

export const applicationSchema = z.object({
  job_id: z.string().uuid(),
  candidate: z.object({
    full_name: z.string().min(2).max(120).trim(),
    email: z.string().email().max(254).toLowerCase().trim(),
    phone: z.string().max(32).trim().optional().or(z.literal('')),
    resume_url: z.string().url().optional().or(z.literal('')),
  }),
});

// ────────────────────────────────────────────────────────────────────────────
// Recrutamento > Entrevistas
// ────────────────────────────────────────────────────────────────────────────

export const interviewCreateSchema = z.object({
  candidate_id: z.string().uuid(),
  job_opening_id: z.string().uuid().nullable().optional(),
  interviewer_id: z.string().uuid().nullable().optional(),
  scheduled_at: z.string().datetime({ offset: true }).or(z.string().min(1)),
  notes: z.string().max(2000).trim().optional().or(z.literal('')),
});

export const interviewUpdateSchema = z.object({
  status: z.enum(['agendada', 'realizada', 'cancelada', 'reagendada']).optional(),
  notes: z.string().max(2000).trim().optional().or(z.literal('')),
}).refine((v) => v.status !== undefined || v.notes !== undefined, {
  message: 'Nada para atualizar.',
});

// ────────────────────────────────────────────────────────────────────────────
// Onboarding > Treinamentos
// ────────────────────────────────────────────────────────────────────────────

export const trainingProgressSchema = z.object({
  training_id: z.string().uuid(),
  progress_pct: z.number().int().min(0).max(100),
});

export const trainingCreateSchema = z.object({
  title: z.string().min(2).max(140).trim(),
  description: z.string().max(2000).trim().optional().or(z.literal('')),
});

// ────────────────────────────────────────────────────────────────────────────
// Recrutamento > criar vaga
// ────────────────────────────────────────────────────────────────────────────

export const jobOpeningCreateSchema = z.object({
  title: z.string().min(2).max(140).trim(),
  department_id: z.string().uuid().nullable().optional(),
  location: z.string().max(120).trim().optional().or(z.literal('')),
  employment_type: z.enum(['clt', 'pj', 'estagio', 'temporario']).default('clt'),
  description: z.string().max(4000).trim().optional().or(z.literal('')),
});

// ────────────────────────────────────────────────────────────────────────────
// Colaboradores > cadastrar escala
// ────────────────────────────────────────────────────────────────────────────

export const scheduleCreateSchema = z.object({
  profile_id: z.string().uuid(),
  shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data AAAA-MM-DD'),
  shift_type: z.enum(['manha', 'tarde', 'noite', 'folga']),
});

// ────────────────────────────────────────────────────────────────────────────
// Assistente RH > adicionar FAQ
// ────────────────────────────────────────────────────────────────────────────

export const hrFaqCreateSchema = z.object({
  question: z.string().min(4).max(300).trim(),
  answer: z.string().min(4).max(2000).trim(),
});

// ────────────────────────────────────────────────────────────────────────────
// Assistente RH
// ────────────────────────────────────────────────────────────────────────────

export const hrAssistantMessageSchema = z.object({
  conversation_id: z.string().uuid().nullable().optional(),
  message: z.string().min(1, 'mensagem vazia').max(2000).trim(),
});

export const hrConversationUpdateSchema = z.object({
  status: z.enum(['open', 'resolved', 'escalated']),
});

// ────────────────────────────────────────────────────────────────────────────
// Stripe
// ────────────────────────────────────────────────────────────────────────────

export const checkoutSchema = z.object({
  plan_id: z.string().min(1).max(64),
  interval: z.enum(['month', 'year']).default('month'),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

// ────────────────────────────────────────────────────────────────────────────
// Mural (feed, comunicados, enquetes)
// ────────────────────────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD');

export const muralCreateSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('post'),
    body: z.string().trim().min(1).max(4000),
    comunicado: z.boolean().optional().default(false),
  }),
  z.object({
    type: z.literal('poll'),
    question: z.string().trim().min(3).max(300),
    options: z.array(z.string().trim().min(1).max(120)).min(2).max(8),
    anonymous: z.boolean().optional().default(false),
    closes_at: z.string().datetime().nullable().optional(),
  }),
  z.object({
    type: z.literal('parabens'),
    subject_profile_id: z.string().uuid(),
    body: z.string().trim().min(1).max(500),
  }),
]);

export const postActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('react') }),
  z.object({ action: z.literal('comment'), body: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal('pin'), pinned: z.boolean() }),
]);

export const pollVoteSchema = z.object({ option_id: z.string().uuid() });

export const birthDateSchema = z.object({ birth_date: isoDate.nullable() });

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

// ────────────────────────────────────────────────────────────────────────────
// Autoatendimento (férias, solicitações, eventos, assinatura)
// ────────────────────────────────────────────────────────────────────────────

export const autoatendimentoCreateSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ferias'),
    kind: z.enum(['ferias', 'folga', 'licenca']).default('ferias'),
    start_date: isoDate,
    end_date: isoDate,
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({
    type: z.literal('solicitacao'),
    category: z.enum(['documento', 'beneficio', 'dados_cadastrais', 'holerite', 'ponto', 'outro']),
    subject: z.string().trim().min(3).max(160),
    body: z.string().trim().min(1).max(4000),
  }),
  z.object({
    type: z.literal('evento'),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(4000).optional(),
    location: z.string().trim().max(200).optional(),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime().nullable().optional(),
    capacity: z.number().int().positive().max(100000).nullable().optional(),
  }),
  z.object({
    type: z.literal('assinatura'),
    title: z.string().trim().min(3).max(160),
    content: z.string().trim().min(1).max(20000),
    /** Lista de quem assina. Vazio/ausente = todos os colaboradores ativos. */
    profile_ids: z.array(z.string().uuid()).max(2000).optional(),
  }),
]);

export const leaveDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected', 'canceled']),
  decision_note: z.string().trim().max(1000).optional(),
});

export const serviceRequestUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'done', 'rejected']),
  response: z.string().trim().max(4000).optional(),
});

export const signatureActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sign'), signed_name: z.string().trim().min(3).max(160) }),
  z.object({ action: z.literal('decline') }),
]);
