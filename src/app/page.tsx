import { redirect } from 'next/navigation';

/**
 * Rota raiz ("/"). Sem este arquivo, o Next.js não tem nenhuma página
 * para o domínio principal e a Vercel devolve 404 — foi exatamente
 * isso que estava acontecendo.
 *
 * Por enquanto redireciona para o login. A landing page completa
 * (fortixx-landing.html) ainda precisa ser portada para uma rota React
 * de verdade — ver README.md → "O que ainda falta". Quando isso for
 * feito, troque este redirect pelo componente da landing.
 */
export default function RootPage() {
  redirect('/auth/login');
}
