import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applySchema, MAX_RESUME_BYTES, ALLOWED_RESUME_MIME } from '@/lib/validation/schemas';
import { isAllowedWebhookUrl } from '@/lib/validation/webhook';

/**
 * Rota PÚBLICA (sem autenticação) — usada pelo Portal de Currículos.
 * Por isso usa o createAdminClient (bypassa RLS): um candidato não tem
 * conta no sistema, mas precisa poder se candidatar.
 *
 * Fluxo:
 * 1. Recebe dados do formulário + arquivo de currículo
 * 2. Valida com Zod + checa MIME/tamanho do upload
 * 3. Faz upload do currículo no Storage
 * 4. Cria o registro em `candidates` com stage='recebido'
 * 5. Dispara o workflow do n8n (com URL validada contra SSRF)
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  const formData = await req.formData();

  // V6: validacao Zod em todos os campos do form (fail-closed -> 400)
  const parsed = applySchema.safeParse({
    job_opening_id: formData.get('job_opening_id'),
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    phone: formData.get('phone') || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const { job_opening_id: jobOpeningId, full_name: fullName, email, phone } = parsed.data;

  // V6: validação extra de upload (file não vai pelo Zod)
  const resumeFile = formData.get('resume') as File | null;
  if (resumeFile && resumeFile.size > 0) {
    if (resumeFile.size > MAX_RESUME_BYTES) {
      return NextResponse.json({ error: 'Arquivo de currículo excede 5MB.' }, { status: 413 });
    }
    if (!ALLOWED_RESUME_MIME.has(resumeFile.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo não permitido.' }, { status: 415 });
    }
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
  if (resumeFile && resumeFile.size > 0) {
    // V7: sanitiza nome do arquivo contra path traversal
    const safeBaseName = resumeFile.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 80) || 'resume';
    const path = `${job.tenant_id}/candidates/${Date.now()}-${safeBaseName}`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(path, resumeFile, { contentType: resumeFile.type, upsert: false });
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
      phone: phone || null,
      resume_url: resumeUrl,
      stage: 'recebido',
      source: 'portal_publico',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Erro ao registrar candidatura.' }, { status: 500 });
  }

  // V2: SSRF block — só chama n8n se URL passa na allowlist
  const n8nUrl = process.env.N8N_WEBHOOK_URL_RESUME_PARSE;
  if (n8nUrl && isAllowedWebhookUrl(n8nUrl)) {
    fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.N8N_WEBHOOK_SECRET!,
      },
      body: JSON.stringify({ candidate_id: candidate.id, resume_path: resumeUrl }),
    }).catch((err) => console.error('Falha ao acionar n8n:', err));
  } else if (n8nUrl) {
    console.warn('[n8n:skipped] URL bloqueada por allowlist (SSRF protection)');
  }

  return NextResponse.json({ success: true, candidate_id: candidate.id });
}
