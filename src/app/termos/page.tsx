import Link from 'next/link';
import { Logo } from '@/components/Logo';

/**
 * Placeholder honesto — não é um Termos de Uso de verdade (isso é
 * conteúdo jurídico, não algo pra gerar automaticamente). Só existe
 * pra não deixar o link do rodapé em 404 até o texto real ser escrito.
 */
export default function TermosPage() {
  return (
    <>
      <div className="ambient" aria-hidden="true">
        <div className="orb orb-1" />
      </div>
      <header className="login-topbar">
        <Link className="logo" href="/">
          <Logo />
        </Link>
      </header>
      <main className="login-main">
        <div className="login-card-wrap">
          <div className="login-card glass">
            <span className="login-eyebrow">Termos de Uso</span>
            <h1 className="login-title">Ainda em construção</h1>
            <p className="login-sub">
              O texto oficial dos Termos de Uso ainda não foi publicado. Se precisar de alguma informação
              contratual antes disso, fale com a gente.
            </p>
            <Link className="btn btn-ghost" href="/" style={{ marginTop: 16, display: 'inline-block', textAlign: 'center' }}>
              Voltar ao início
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
