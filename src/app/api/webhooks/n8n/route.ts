import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Webhook RECEPTOR — chamado pelo n8n quando termina de processar um
 * documento (OCR de currículo, RG, comprovante, contrato). Protegido por
 * um segredo compartilhado (N8N_WEBHOOK_SECRET), não por autenticação de
 * usuário, porque quem chama é o n8n, não uma pessoa.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('X-Webhook-Secret');
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const payload = await req.json();

  switch (payload.type) {
    case 'resume_parsed': {
      const { candidate_id, extracted } = payload;
      // extracted = { name, email, phone, skills[], experience_years, ... }
      await supabase
        .from('candidates')
        .update({
          notes: `Extraído automaticamente: ${JSON.stringify(extracted)}`,
        })
        .eq('id', candidate_id);
      break;
    }

    case 'document_ocr_completed': {
      const { document_id, category, confidence, extracted } = payload;
      await supabase
        .from('documents')
        .update({
          ocr_status: 'concluido',
          ocr_confidence: confidence,
          ocr_extracted: extracted,
          category,
        })
        .eq('id', document_id);
      break;
    }

    default:
      return NextResponse.json({ error: 'Tipo de evento desconhecido.' }, { status: 400 });
  }

  return NextResponse.json({ received: true });
}
