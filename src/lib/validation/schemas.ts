/**
 * Schemas Zod compartilhados — borda de validação em TODAS as rotas API.
 * Fail-closed: input inválido → 400 com mensagem genérica, log interno.
 *
 * Padrão (V6 do code review):
 * - tamanho máximo explícito em strings (anti-DoS)
 * - regex estrito (anti-XSS-injection-into-storage)
 * - enums quando aplicável (anti-typos que viram bugs)
 */
import { z } from 'zod';

// ============================================================================
// Primitivos reutilizáveis
// ============================================================================
const idSchema = z.string().uuid('id deve ser UUID');
const emailSchema = z.string().email('e-mail inválido').max(254).toLowerCase().trim();
const phoneSchema = z
  .string()
  .max(20)
  .regex(/^[\d\s+()-]+$/, 'telefone inválido')
  .trim()
  .optional()
  .or(z.literal(''));
const safeText = (max: number) =>
  z.string().max(max).trim().regex(/^[^\x00-\x1F\x7F<>]*$/, 'caracteres de controle proibidos');

// ============================================================================
// /api/recrutamento/apply — POST (público, candidato)
// ============================================================================
export const applySchema = z.object({
  job_opening_id: idSchema,
  full_name: safeText(120),
  email: emailSchema,
  phone: phoneSchema,
  // resume (File) é validado no handler (tamanho + MIME), não no Zod
});

// ============================================================================
// /api/recrutamento/[id]/approve — POST (autenticado, RH/admin)
// ============================================================================
export const approveCandidateParamsSchema = z.object({
  id: idSchema,
});

// ============================================================================
// /api/stripe/checkout — POST (autenticado)
// ============================================================================
export const checkoutSchema = z.object({
  plan: z.enum(['basico', 'pro', 'enterprise'], {
    errorMap: () => ({ message: 'plano inválido' }),
  }),
});

// ============================================================================
// /api/webhooks/n8n — POST (assinatura de secret)
// ============================================================================
export const n8nResumeParsedSchema = z.object({
  type: z.literal('resume_parsed'),
  candidate_id: idSchema,
  tenant_id: idSchema, // obrigatório — checa ownership
  extracted: z.object({
    name: z.string().max(200).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema,
    skills: z.array(z.string().max(60)).max(50).optional(),
    experience_years: z.number().int().min(0).max(70).optional(),
  }).passthrough(),
});

export const n8nDocumentOcrSchema = z.object({
  type: z.literal('document_ocr_completed'),
  document_id: idSchema,
  tenant_id: idSchema,
  category: z.string().max(60),
  confidence: z.number().min(0).max(1),
  extracted: z.record(z.string().max(200), z.unknown()),
});

export const n8nWebhookSchema = z.discriminatedUnion('type', [
  n8nResumeParsedSchema,
  n8nDocumentOcrSchema,
]);

// ============================================================================
// /api/onboarding — POST (admin-only, provisiona user+tenant+profile)
// ============================================================================
export const onboardingSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, 'senha deve ter pelo menos 8 caracteres')
    .max(200, 'senha longa demais'),
  full_name: safeText(120),
  company_name: safeText(120).optional().or(z.literal('')),
  existing_tenant_id: idSchema.optional(),
  role: z.enum(['admin', 'rh', 'gestor', 'colaborador']).default('admin'),
});

// ============================================================================
// Limites numéricos
// ============================================================================
export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_RESUME_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
