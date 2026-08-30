import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Rota PÚBLICA (sem autenticação) — usada pelo Portal de Currículos.
 * Por isso usa o createAdminClient (bypassa RLS): um candidato não tem
 * conta no sistema, mas precisa poder se candidatar.
 *
 * Fluxo:
 * 1. Recebe dados do formulário + arquivo de currículo
 * 2. Faz upload do currículo no Storage
 * 3. Cria o registro em `candidates` com stage='recebido'
 * 4. Dispara o workflow do n8n que processa OCR do currículo
 *    (extrai nome/email/telefone/skills) e atualiza o registro
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  const formData = await req.formData();

  const jobOpeningId = formData.get('job_opening_id') as string;
  const fullName = formData.get('full_name') as string;
  const email = formData.get('email') as string;
  const phone = formData.get('phone') as string;
  const resumeFile = formData.get('resume') as File | null;

  if (!jobOpeningId || !fullName || !email) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 });
  }

  const { data: job } = await supabase
    .from('job_openings')
    .select('tenant_id')
    .eq('id', jobOpeningId)
    .single();

  if (!job) {
    return NextResponse.json({ error: 'Vaga não encontrada.' }, { status: 404 });
  }

  let resumeUrl: string | null = null;
  if (resumeFile) {
    const path = `${job.tenant_id}/candidates/${Date.now()}-${resumeFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(path, resumeFile);
    if (!uploadError) {
      resumeUrl = path;
    }
  }

  const { data: candidate, error } = await supabase
    .from('candidates')
    .insert({
      tenant_id: job.tenant_id,
      job_opening_id: jobOpeningId,
      full_name: fullName,
      email,
      phone,
      resume_url: resumeUrl,
      stage: 'recebido',
      source: 'portal_publico',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Erro ao registrar candidatura.' }, { status: 500 });
  }

  // Dispara o workflow do n8n para processar o currículo em segundo plano
  if (process.env.N8N_WEBHOOK_URL_RESUME_PARSE) {
    fetch(process.env.N8N_WEBHOOK_URL_RESUME_PARSE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET!,
      },
      body: JSON.stringify({ candidate_id: candidate.id, resume_path: resumeUrl }),
    }).catch((err) => console.error('Falha ao acionar n8n:', err));
  }

  return NextResponse.json({ success: true, candidate_id: candidate.id });
}
