import { ThemeToggle } from '@/components/ThemeToggle';

/**
 * Todas as telas de autenticação (login, verificação 2FA, setup-2FA,
 * redefinir senha) ganham o toggle claro/escuro no canto — o mesmo botão
 * animado da landing. A escolha é compartilhada com o resto do site.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ThemeToggle className="theme-toggle-fixed" />
    </>
  );
}
