import Link from 'next/link';
import { Logo } from '@/components/Logo';

export const metadata = {
  title: 'Termos de Uso — Fortixx RH',
  description: 'Termos e condições de uso da plataforma Fortixx RH.',
};

/**
 * Minuta de Termos de Uso — cobre o essencial de um SaaS B2B de RH no
 * Brasil (assinatura, LGPD como operador, limitação de responsabilidade,
 * uso aceitável, rescisão). NÃO é aconselhamento jurídico: um advogado
 * deve revisar e ajustar razão social, CNPJ, foro e valores antes de
 * virar a versão oficial. Ver o doc do vault `fortixx-saas-juridico`.
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
        <Link className="link-accent" href="/">Voltar ao início</Link>
      </header>

      <article className="legal-wrap">
        <h1>Termos de Uso</h1>
        <p className="legal-meta">Última atualização: 10 de setembro de 2026 · versão 1.0</p>

        <div className="legal-callout">
          Ao criar uma conta ou usar a Fortixx RH, você declara que leu, entendeu e concorda
          com estes Termos e com a <Link href="/privacidade">Política de Privacidade</Link>.
          Se você aceita em nome de uma empresa, declara ter poderes para isso.
        </div>

        <h2>1. Quem somos</h2>
        <p>
          &ldquo;Fortixx RH&rdquo;, &ldquo;plataforma&rdquo; ou &ldquo;nós&rdquo; se refere ao serviço de software
          para gestão de recursos humanos disponibilizado em <strong>fortixx-saas.vercel.app</strong>
          e domínios relacionados, operado por <strong>[RAZÃO SOCIAL], CNPJ [00.000.000/0000-00]</strong>,
          com contato em <strong>[e-mail de contato]</strong>.
        </p>

        <h2>2. O serviço</h2>
        <p>
          A Fortixx RH é uma ferramenta de RH multiempresa que inclui, entre outros: cadastro de
          colaboradores e organograma, recrutamento e banco de currículos, onboarding, escalas de
          trabalho, gestão de documentos com leitura automática (OCR), treinamentos, um assistente
          de dúvidas de RH e relatórios.
        </p>
        <p>
          O serviço é fornecido <strong>&ldquo;no estado em que se encontra&rdquo;</strong>. Podemos alterar,
          adicionar ou remover funcionalidades a qualquer momento, avisando com antecedência
          razoável quando a mudança for relevante.
        </p>

        <h2>3. Conta, planos e pagamento</h2>
        <ul>
          <li>Você é responsável por manter a confidencialidade das credenciais e por toda atividade na sua conta. Ative a verificação em duas etapas (2FA).</li>
          <li>Há um período de avaliação gratuito. Após ele, o acesso depende de assinatura ativa de um dos planos vigentes.</li>
          <li>Os pagamentos são processados por terceiros (ex.: Cakto, Stripe). Não armazenamos dados completos de cartão.</li>
          <li>A cobrança é recorrente e renovada automaticamente até o cancelamento. O cancelamento encerra a renovação seguinte; não há reembolso proporcional de período já pago, salvo quando exigido por lei.</li>
          <li>Falha de pagamento pode suspender o acesso após notificação.</li>
        </ul>

        <h2>4. Uso aceitável</h2>
        <p>Você concorda em não:</p>
        <ul>
          <li>usar a plataforma para fim ilícito, discriminatório ou que viole direitos de terceiros;</li>
          <li>inserir dados de pessoas sem base legal para tratá-los;</li>
          <li>tentar acessar áreas, contas ou dados de outras empresas (tenants);</li>
          <li>fazer engenharia reversa, descompilar, copiar, revender, sublicenciar ou criar produto derivado da plataforma;</li>
          <li>raspar (scraping), sobrecarregar, testar vulnerabilidade sem autorização escrita, ou burlar limites de uso, autenticação ou proteção anti-bot;</li>
          <li>revender ou compartilhar o acesso com terceiros fora da sua empresa.</li>
        </ul>

        <h2>5. Propriedade intelectual</h2>
        <p>
          Todo o código, design, marca, textos e a estrutura da plataforma são de nossa propriedade
          exclusiva. Estes Termos não transferem nenhum direito de propriedade intelectual a você —
          apenas uma licença de uso limitada, não exclusiva, intransferível e revogável enquanto a
          assinatura estiver ativa. <strong>Os dados que você insere continuam seus.</strong>
        </p>

        <h2>6. Dados pessoais (LGPD)</h2>
        <p>
          No tratamento de dados de colaboradores e candidatos da sua empresa, <strong>a sua empresa é a
          controladora</strong> e a <strong>Fortixx RH é a operadora</strong> (Lei nº 13.709/2018). Nós tratamos
          esses dados apenas conforme suas instruções e o previsto na
          <Link href="/privacidade"> Política de Privacidade</Link>, que integra estes Termos e funciona
          como acordo de tratamento de dados. Você é responsável por ter base legal para os dados que
          insere e por informar os titulares.
        </p>

        <h2>7. Disponibilidade e responsabilidade</h2>
        <ul>
          <li>Buscamos alta disponibilidade, mas não garantimos operação ininterrupta ou livre de erros. Manutenções e indisponibilidades de terceiros (hospedagem, banco, provedores de pagamento) podem ocorrer.</li>
          <li>Na máxima extensão permitida por lei, nossa responsabilidade total por qualquer reclamação relacionada ao serviço fica limitada ao valor pago por você nos <strong>12 meses</strong> anteriores ao fato.</li>
          <li>Não respondemos por lucros cessantes, perda de dados por culpa exclusiva sua, decisões de RH tomadas com base na plataforma, ou uso indevido por seus usuários.</li>
          <li>Você mantém a Fortixx RH indene de reclamações de terceiros decorrentes do uso que você fez da plataforma ou de dados que você inseriu sem base legal.</li>
        </ul>

        <h2>8. Vigência e rescisão</h2>
        <p>
          Estes Termos valem enquanto você usar a plataforma. Você pode cancelar a qualquer momento
          pelo painel ou pelo contato de suporte. Podemos suspender ou encerrar o acesso em caso de
          violação destes Termos, falta de pagamento ou exigência legal. Após o encerramento, você tem
          <strong> 30 dias</strong> para exportar seus dados; depois disso eles podem ser eliminados de forma
          definitiva, salvo o que a lei exigir reter.
        </p>

        <h2>9. Alterações</h2>
        <p>
          Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas por e-mail ou aviso no
          painel com pelo menos <strong>15 dias</strong> de antecedência. O uso após a vigência da nova versão
          significa concordância.
        </p>

        <h2>10. Lei aplicável e foro</h2>
        <p>
          Estes Termos são regidos pela lei brasileira. Fica eleito o foro da comarca de
          <strong> [cidade/UF]</strong>, com renúncia a qualquer outro, por mais privilegiado que seja.
        </p>

        <div className="legal-callout">
          <strong>Aviso:</strong> esta é uma minuta. Antes de tratar como documento oficial, um advogado
          deve revisar e preencher razão social, CNPJ, contato, foro e condições comerciais.
        </div>

        <p style={{ marginTop: 24 }}>
          <Link className="link-accent" href="/privacidade">Ler a Política de Privacidade →</Link>
        </p>
      </article>
    </>
  );
}
