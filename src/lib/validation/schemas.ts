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
// Stripe
// ────────────────────────────────────────────────────────────────────────────

export const checkoutSchema = z.object({
  plan_id: z.string().min(1).max(64),
  interval: z.enum(['month', 'year']).default('month'),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});
