import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, badRequest, serverError } from '@/lib/auth/session';
import { signatureActionSchema } from '@/lib/validation/schemas';
import { signatureHash } from '@/lib/autoatendimento';
import { notify } from '@/lib/notify';

/**
 * POST { action: 'sign', signed_name } | { action: 'decline' }
 *
 * Assinatura eletrônica SIMPLES (Lei 14.063/2020, art. 4º, I). Só o próprio
 * signatário, logado (login + 2FA), assina. Grava como evidência: nome
 * digitado, data/hora do servidor, IP, navegador e confere que o hash do
 * conteúdo ainda bate com o que foi enviado (ninguém editou o texto depois).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireProfile();
  if ('error' in auth) return auth.error;
  const { profile } = auth;

  const parsed = signatureActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();

  const db = createAdminClient();
  const { data: sig } = await db
    .from('signature_requests')
    .select('id, profile_id, title, content, content_hash, status, requested_by')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single();
  if (!sig) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  if (sig.profile_id !== profile.id) {
    return NextResponse.json({ error: 'Só a pessoa indicada pode assinar este documento.' }, { status: 403 });
  }
  if (sig.status !== 'pending') return badRequest('Este documento já foi respondido.');
  if (signatureHash(sig.title, sig.content) !== sig.content_hash) {
    return serverError('O conteúdo do documento não confere com o original. Fale com o RH.');
  }

  if (parsed.data.action === 'decline') {
    const { error } = await db.from('signature_requests').update({ status: 'declined' }).eq('id', sig.id);
    if (error) return serverError();
  } else {
    const typed = parsed.data.signed_name.toLowerCase().replace(/\s+/g, ' ');
    const real = profile.full_name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (typed !== real) return badRequest('Digite seu nome completo exatamente como está no cadastro.');

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
    const { error } = await db
      .from('signature_requests')
      .update({
        status: 'signed',
        signed_name: parsed.data.signed_name,
        signed_at: new Date().toISOString(),
        signer_ip: ip,
        signer_user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
      })
      .eq('id', sig.id)
      .eq('status', 'pending');
    if (error) return serverError('Falha ao registrar a assinatura.');
  }

  if (sig.requested_by && sig.requested_by !== profile.id) {
    await notify({
      tenantId: profile.tenant_id,
      profileIds: [sig.requested_by],
      category: 'documentos',
      title: `${profile.full_name} ${parsed.data.action === 'sign' ? 'assinou' : 'recusou'}: ${sig.title}`,
      url: '/dashboard',
    });
  }
  return NextResponse.json({ success: true, content_hash: sig.content_hash });
}
