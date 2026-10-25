import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireProfile, badRequest, serverError } from '@/lib/auth/session';
import { serviceRequestUpdateSchema } from '@/lib/validation/schemas';
import { notify } from '@/lib/notify';

const STATUS_LABEL = {
  open: 'reaberta',
  in_progress: 'em andamento',
  done: 'concluída',
  rejected: 'recusada',
} as const;

/**
 * PATCH { status, response? } — RH/admin atendem uma solicitação.
 * Avisa o colaborador a cada mudança.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireProfile(['admin', 'rh']);
  if ('error' in auth) return auth.error;
  const { profile } = auth;

  const parsed = serviceRequestUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();

  const db = createAdminClient();
  const { data: sr } = await db
    .from('service_requests')
    .select('id, profile_id, subject')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single();
  if (!sr) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 });

  const patch: { status: typeof parsed.data.status; handled_by: string; updated_at: string; response?: string } = {
    status: parsed.data.status,
    handled_by: profile.id,
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.response) patch.response = parsed.data.response;

  const { error } = await db.from('service_requests').update(patch).eq('id', sr.id);
  if (error) return serverError();

  if (sr.profile_id !== profile.id) {
    await notify({
      tenantId: profile.tenant_id,
      profileIds: [sr.profile_id],
      category: 'documentos',
      title: `Solicitação ${STATUS_LABEL[parsed.data.status]}: ${sr.subject}`,
      message: parsed.data.response?.slice(0, 140),
      url: '/dashboard',
    });
  }
  return NextResponse.json({ success: true });
}
