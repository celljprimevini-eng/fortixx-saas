import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseResume } from '@/lib/recrutamento/parse-resume';

/**
 * Rota PÚBLICA (sem autenticação) — usada pelo Portal de Currículos.
 * Por isso usa o createAdminClient (bypassa RLS): um candidato não tem
 * conta no sistema, mas precisa poder se candidatar.
 *
 * Fluxo:
 * 1. Recebe dados do formulário + arquivo de currículo
 * 2. Faz upload do currículo no Storage
 * 3. Cria o registro em `candidates` com stage='recebido'
 * 4. Faz o parsing do currículo AQUI MESMO (grátis, sem n8n): PDF via
 *    unpdf — extrai texto + e-mail + telefone + skills e grava em
 *    resume_raw_text / extracted_skills. Imagem fica sem parsing (OCR no
 *    servidor estoura o timeout) — o arquivo é salvo mesmo assim.
 */
export const maxDuration = 30;

const RESUME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  const formData = await req.formData();

  const field = (name: string, max: number) => String(formData.get(name) ?? '').trim().slice(0, max);
  const jobOpeningId = field('job_opening_id', 64);
  const fullName = field('full_name', 200);
  const email = field('email', 254).toLowerCase();
  const phone = field('phone', 40);
  const resumeEntry = formData.get('resume');
  const resumeFile = resumeEntry instanceof File ? resumeEntry : null;

  if (!jobOpeningId || !fullName || !email) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }
  if (resumeFile && resumeFile.size > 0 && !RESUME_TYPES.includes(resumeFile.type)) {
    return NextResponse.json(
      { error: 'Formato de currículo não suportado (use PDF, DOC, DOCX, JPG ou PNG).' },
      { status: 400 },
    );
  }

  const { data: job } = await supabase
    .from('job_openings')
    .select('tenant_id')
    .eq('id', jobOpeningId)
    .eq('status', 'open')
    .eq('is_public', true)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: 'Vaga não encontrada.' }, { status: 404 });
  }

  let resumeUrl: string | null = null;
  let resumeBuffer: Buffer | null = null;
  let resumeMime = '';
  if (resumeFile && resumeFile.size > 0 && resumeFile.size <= 10 * 1024 * 1024) {
    const safeName = resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const path = `${job.tenant_id}/candidates/${Date.now()}-${safeName}`;
    resumeBuffer = Buffer.from(await resumeFile.arrayBuffer());
    resumeMime = resumeFile.type || safeName;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(path, resumeBuffer, { contentType: resumeFile.type || 'application/octet-stream' });
    if (!uploadError) resumeUrl = path;
  }

  // Parsing do currículo — grátis, sem n8n. Best-effort: nunca derruba a
  // candidatura.
  let parsed: { raw_text: string; email: string | null; phone: string | null; skills: string[] } | null = null;
  if (resumeBuffer) {
    try {
      parsed = await parseResume(resumeBuffer, resumeMime);
    } catch (err) {
      console.error('[apply] parse-resume falhou:', err);
    }
  }

  const { data: candidate, error } = await supabase
    .from('candidates')
    .insert({
      tenant_id: job.tenant_id,
      job_opening_id: jobOpeningId,
      full_name: fullName,
      email, // o e-mail digitado vale mais que o extraído do currículo
      phone: phone || parsed?.phone || null,
      resume_url: resumeUrl,
      resume_raw_text: parsed?.raw_text || null,
      extracted_skills: parsed?.skills?.length ? parsed.skills : null,
      stage: 'recebido',
      source: 'portal_publico',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Erro ao registrar candidatura.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    candidate_id: candidate.id,
    parsed_skills: parsed?.skills ?? [],
  });
}
