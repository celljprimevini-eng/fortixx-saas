import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Upload + registro de documento digitalizado.
 *
 * O OCR em si roda no NAVEGADOR (Tesseract.js, self-hosted em /tesseract/) —
 * esta rota só recebe o arquivo já processado + o que foi extraído, sobe pro
 * Supabase Storage (bucket `documents`, path {tenant}/{profile}/{uuid}) e cria
 * a linha em `documents`. Rápido, sem risco de timeout de função.
 *
 * multipart/form-data:
 *   file        (obrigatório) imagem ou PDF, até 10MB
 *   category    identidade|comprovante|contrato|curriculo|outro (ou vazio)
 *   confidence  número 0-100 (média de confiança do OCR)
 *   extracted   JSON com os campos lidos ({cpf, rg, nome, data, tipo, texto})
 *   profile_id  de quem é o documento (default: o próprio usuário logado)
 */

export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const CATEGORIES = ['identidade', 'comprovante', 'contrato', 'curriculo', 'outro'] as const;
type Categoria = (typeof CATEGORIES)[number];

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo ausente.' }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Arquivo vazio ou maior que 10MB.' }, { status: 400 });
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Formato não suportado (use JPG, PNG ou PDF).' }, { status: 400 });
  }

  const rawCategory = String(form.get('category') || '').trim();
  const category: Categoria | null = (CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as Categoria)
    : null;

  const confidenceNum = Number(form.get('confidence'));
  const confidence = Number.isFinite(confidenceNum)
    ? Math.max(0, Math.min(100, Math.round(confidenceNum * 10) / 10))
    : null;
  const ocrStatus = confidence != null && confidence < 60 ? 'baixa_confianca' : 'concluido';

  let extracted: Record<string, unknown> | null = null;
  try {
    const raw = form.get('extracted');
    if (typeof raw === 'string' && raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') extracted = parsed as Record<string, unknown>;
    }
  } catch {
    extracted = null;
  }

  // Documento de quem? Colaborador só sobe pra si; admin/rh podem indicar outro.
  const requestedProfile = String(form.get('profile_id') || '').trim();
  let profileId = user.id;
  if (requestedProfile && requestedProfile !== user.id) {
    if (!['admin', 'rh'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão para enviar documento de outra pessoa.' }, { status: 403 });
    }
    const admin0 = createAdminClient();
    const { data: target } = await admin0
      .from('profiles')
      .select('id')
      .eq('id', requestedProfile)
      .eq('tenant_id', profile.tenant_id)
      .single();
    if (!target) return NextResponse.json({ error: 'Colaborador não encontrado.' }, { status: 404 });
    profileId = requestedProfile;
  }

  const admin = createAdminClient();
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || `documento.${ext}`;
  const path = `${profile.tenant_id}/${profileId}/${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from('documents')
    .upload(path, buffer, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (upErr) {
    console.error('[documents/upload] storage falhou:', upErr);
    return NextResponse.json(
      { error: 'Falha ao salvar o arquivo.', detail: upErr.message },
      { status: 500 }
    );
  }

  const { data: signed } = await admin.storage
    .from('documents')
    .createSignedUrl(path, 60 * 60 * 24 * 30);

  const { data: created, error: insErr } = await admin
    .from('documents')
    .insert({
      tenant_id: profile.tenant_id,
      profile_id: profileId,
      file_name: safeName,
      file_url: signed?.signedUrl ?? path,
      file_size_bytes: file.size,
      category,
      ocr_status: ocrStatus,
      ocr_confidence: confidence,
      ocr_extracted: extracted as never,
      approval_status: 'pending',
      uploaded_by: user.id,
    })
    .select('id, file_name, category, ocr_status, ocr_confidence, created_at')
    .single();

  if (insErr || !created) {
    await admin.storage.from('documents').remove([path]);
    return NextResponse.json({ error: 'Falha ao registrar o documento.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, document: created });
}
