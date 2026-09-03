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
