import { z } from 'zod';

/**
 * Webhook event schemas — valida payload de entrada do Stripe / n8n
 * antes de processar. Falha = 400 (não 500).
 */

export const stripeEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
  created: z.number(),
  livemode: z.boolean(),
});

export const n8nEventSchema = z.object({
  event: z.string().min(1).max(64),
  tenant_id: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
});
