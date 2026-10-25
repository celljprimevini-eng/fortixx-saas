import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

type Category = 'documentos' | 'escalas' | 'onboarding' | 'sistema';

interface NotifyArgs {
  tenantId: string;
  /** Destinatários. Vazio = ninguém. */
  profileIds: string[];
  category: Category;
  title: string;
  message?: string;
  /** Link aberto ao clicar no push. */
  url?: string;
}

let vapidReady: boolean | null = null;
function ensureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    vapidReady = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@fortixx.com.br', pub, priv);
  vapidReady = true;
  return true;
}

/**
 * Notifica pessoas do tenant: grava no sino do painel (`notifications`) e,
 * se houver chaves VAPID e o navegador da pessoa aceitou, manda Web Push.
 *
 * Nunca lança: falha de notificação não pode derrubar a ação que a causou
 * (aprovar férias, publicar comunicado...).
 */
export async function notify({ tenantId, profileIds, category, title, message, url }: NotifyArgs) {
  const ids = Array.from(new Set(profileIds)).filter(Boolean);
  if (ids.length === 0) return;
  const admin = createAdminClient();

  try {
    await admin.from('notifications').insert(
      ids.map((profile_id) => ({
        tenant_id: tenantId,
        profile_id,
        category,
        title,
        message: message ?? null,
        read: false,
      })),
    );
  } catch (err) {
    console.error('[notify] falha ao gravar notificação:', err);
  }

  if (!ensureVapid()) return;

  try {
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('tenant_id', tenantId)
      .in('profile_id', ids);

    const payload = JSON.stringify({ title, body: message ?? '', url: url ?? '/dashboard' });
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            TTL: 60 * 60 * 24,
          });
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // 404/410 = inscrição morta (navegador revogou) → remove.
          if (status === 404 || status === 410) {
            await admin.from('push_subscriptions').delete().eq('id', s.id);
          } else {
            console.error('[notify] push falhou:', status ?? err);
          }
        }
      }),
    );
  } catch (err) {
    console.error('[notify] falha ao enviar push:', err);
  }
}

/** Todos os perfis ativos do tenant (pra comunicado geral). */
export async function tenantProfileIds(tenantId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('id').eq('tenant_id', tenantId).neq('status', 'inactive');
  return (data ?? []).map((p) => p.id);
}

/** Perfis com papel de RH/admin no tenant (destinatários de pedidos). */
export async function hrProfileIds(tenantId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('role', ['admin', 'rh'])
    .neq('status', 'inactive');
  return (data ?? []).map((p) => p.id);
}
