/**
 * SSRF protection — valida URL de webhook antes de fetch().
 *
 * Bloqueia:
 * - Protocolos não-HTTPS (http://, file://, gopher://, etc.)
 * - Hostnames em IPs privados (RFC 1918, loopback, link-local)
 * - Hostnames que resolvem para 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12,
 *   192.168.0.0/16, 169.254.0.0/16 (incl. cloud metadata!)
 * - Hostnames não-listados na allowlist (env N8N_ALLOWED_HOSTS)
 *
 * Configuração:
 *   N8N_ALLOWED_HOSTS="n8n.seu-dominio.com,hooks.zapier.com,..."
 *   (separados por vírgula, sem protocolo)
 *
 * Se N8N_ALLOWED_HOSTS não estiver setado, bloqueia TUDO (fail-closed).
 *
 * Como o servidor Next.js roda em Vercel, IPs de saída já são filtrados,
 * mas isso é defense-in-depth — não confie no runtime.
 */

/**
 * Regex / range checks para IPv4 privado. Não cobre IPv6 (raro em hostnames
 * de webhook, mas se aparecer, falha em "hostname não-allowlisted").
 */
function isPrivateIPv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
  if (a === 192 && b === 168) return true;            // 192.168.0.0/16
  if (a === 127) return true;                         // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true;            // 169.254.0.0/16 link-local
  if (a === 0) return true;                           // 0.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true;  // 100.64.0.0/10 carrier-grade NAT
  if (a >= 224) return true;                          // 224.0.0.0/4 multicast
  return false;
}

export function isAllowedWebhookUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false; // Não é URL válida
  }

  // 1. Protocolo — só HTTPS
  if (url.protocol !== 'https:') return false;

  // 2. Hostname não-vazio
  const host = url.hostname.toLowerCase();
  if (!host) return false;

  // 3. IP privado? Bloqueia direto
  if (isPrivateIPv4(host)) return false;

  // 4. Hostnames loopback (localhost, *.localhost)
  if (host === 'localhost' || host.endsWith('.localhost')) return false;

  // 5. Allowlist via env (fail-closed: sem allowlist = bloqueia tudo)
  const allowed = (process.env.N8N_ALLOWED_HOSTS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;

  // Match exato OU subdomínio (ex: "n8n.com" aceita "hooks.n8n.com")
  return allowed.some((pattern) => {
    if (host === pattern) return true;
    if (host.endsWith('.' + pattern)) return true;
    return false;
  });
}
