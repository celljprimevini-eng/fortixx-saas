import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { jobOpeningCreateSchema } from '@/lib/validation/schemas';

/**
 * POST /api/recrutamento/vagas — cria uma vaga (Recrutamento › Vagas,
 * botão "+ Nova vaga"). Exige role admin/rh no tenant do usuário logado,
 * mesmo padrão de api/interviews.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();
  if (!profile || !['admin', 'rh'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sem permissão para criar vagas.' }, { status: 403 });
  }

  const parsed = jobOpeningCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const { title, department_id, location, employment_type, description } = parsed.data;

  const admin = createAdminClient();

  if (department_id) {
    const { data: dept } = await admin
      .from('departments')
      .select('id')
      .eq('id', department_id)
      .eq('tenant_id', profile.tenant_id)
      .single();
    if (!dept) return NextResponse.json({ error: 'Departamento não encontrado.' }, { status: 404 });
  }

  const { data: created, error } = await admin
    .from('job_openings')
    .insert({
      tenant_id: profile.tenant_id,
      title,
      department_id: department_id || null,
      location: location || null,
      employment_type,
      description: description || null,
      status: 'open',
      is_public: true,
    })
    .select('id, title, status')
    .single();

  if (error || !created) {
    return NextResponse.json({ error: 'Falha ao criar a vaga.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, job: created });
}
