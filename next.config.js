/** @type {import('next').NextConfig} */

// ============================================================================
// Headers de segurança — Defense in Depth (ADR-C08).
// Aplicado em TODAS as rotas (headers() global). CSP é permissivo em
// style-src/script-src porque a landing injeta <style> runtime (ripple-kf)
// e usa Google Fonts via next/font. À medida que a landing for refatorada
// pra CSS-in-JS ou CSS modules, apertar a CSP.
//
// Restaurado em 2026-08-27: este bloco existia desde o hardening de
// 30/07 (commit fb35519) mas sumiu do next.config.js num reverte/
// promoção posterior — produção ficou rodando sem CSP/X-Frame-Options/
// etc. por semanas, só com o HSTS default da própria Vercel.
//
// Ajustado em 2026-08-30 (integração do dashboard): frame-ancestors
// 'none' → 'self' e X-Frame-Options DENY → SAMEORIGIN, porque /dashboard
// agora carrega /dashboard/platform num iframe same-origin — DENY
// bloquearia o próprio dashboard novo.
// ============================================================================
const securityHeaders = [
  // CSP — permite self + Supabase + Google Fonts + Stripe (sandbox iframe)
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
  // HSTS — força HTTPS por 1 ano + preload-ready
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  // Clickjacking: só o próprio Fortixx pode iframear o Fortixx (dashboard novo depende disso)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Anti-MIME-sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Referrer mínimo (não vaza URL completa pra terceiros)
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Permissões mínimas — desabilita APIs do navegador que não usamos
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()',
      'payment=(self "https://js.stripe.com")',
    ].join(', '),
  },
  // Cross-Origin Isolation (parcial — prepara pra SharedArrayBuffer se precisar)
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
];

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        // Aplica em TODAS as rotas
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // /login → /auth/login (alguns links antigos apontam /login)
      // O redirect de '/' → '/auth/login' foi REMOVIDO em 2026-08-05:
      // '/' agora É a landing page (src/app/page.tsx), e o login fica
      // acessível por clique em "Entrar" / "Já tenho conta" no header.
      // Rebuild forçado em 2026-08-06 23:40 UTC pra invalidar cache CDN
      // que ainda servia o 307 antigo (commit ce44e81 era tree-igual e
      // foi pulado pelo Vercel).
      {
        source: '/login',
        destination: '/auth/login',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;