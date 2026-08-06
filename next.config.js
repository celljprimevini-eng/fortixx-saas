/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
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