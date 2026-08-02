/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async redirects() {
    return [
      // Redirect raiz / → /auth/login (HTTP 307 server-side, funciona sem JS)
      {
        source: '/',
        destination: '/auth/login',
        permanent: false,
      },
      // /login → /auth/login (alguns links antigos apontam /login)
      {
        source: '/login',
        destination: '/auth/login',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;