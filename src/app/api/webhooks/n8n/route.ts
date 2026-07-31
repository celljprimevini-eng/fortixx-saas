import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { n8nWebhookSchema } from '@/lib/validation/schemas';

/**
 * Webhook RECEPTOR — chamado pelo n8n quando termina de processar um
 * documento (OCR de currículo, RG, comprovante, contrato). Protegido por
 * um segredo compartilhado (N8N_WEBHOOK_SECRET), não por autenticação de
 * usuário, porque quem chama é o n8n, não uma pessoa.
 *
 * V3 (security review): payload é validado por Zod; cada update checa
 * explicitamente o tenant_id do registro antes de modificar (defesa
 * contra payload crafted tentando vazar entre tenants).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('X-Webhook-Secret');
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  if (!process.env.N8N_WEBHOOK_SECRET) {
    // Fail-closed: secret não configurado = rejeita tudo (evita bypass por env vazio)
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await req.json().catch(() => null);

  // V3: validação Zod (discriminated union por type)
  const parsed = n8nWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const payload = parsed.data;

  switch (payload.type) {
    case 'resume_parsed': {
      const { candidate_id, tenant_id, extracted } = payload;
      // V3: checa ownership antes do update (anti cross-tenant)
      const { data: candidate } = await supabase
        .from('candidates')
        .select('id, tenant_id')
        .eq('id', candidate_id)
        .eq('tenant_id', tenant_id)
        .single();
      if (!candidate) {
        return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 });
      }
      await supabase
        .from('candidates')
        .update({
          notes: `Extraído automaticamente: ${JSON.stringify(extracted)}`,
        })
        .eq('id', candidate_id);
      break;
    }

    case 'document_ocr_completed': {
      const { document_id, tenant_id, category, confidence, extracted } = payload;
      // V3: checa ownership antes do update
      const { data: document } = await supabase
        .from('documents')
        .select('id, tenant_id')
        .eq('id', document_id)
        .eq('tenant_id', tenant_id)
        .single();
      if (!document) {
        return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
      }
      await supabase
        .from('documents')
        .update({
          ocr_status: 'concluido',
          ocr_confidence: confidence,
          // Zod já validou (z.record(z.string(), z.unknown())), mas o tipo do
          // Supabase `Json` não aceita `unknown` direto. Round-trip JSON é
          // a forma idiomática de estreitar — qualquer coisa que sobrevive
          // é serializável como JSON.
          ocr_extracted: JSON.parse(JSON.stringify(extracted)) as any,
          category: category as any,
        })
        .eq('id', document_id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
