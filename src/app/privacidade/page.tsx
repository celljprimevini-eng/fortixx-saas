import Link from 'next/link';
import { Logo } from '@/components/Logo';

export const metadata = {
  title: 'Política de Privacidade — Fortixx RH',
  description: 'Como a Fortixx RH trata dados pessoais, conforme a LGPD.',
};

/**
 * Minuta de Política de Privacidade + acordo de tratamento de dados
 * (LGPD). Fortixx = OPERADORA dos dados de RH; a empresa cliente =
 * CONTROLADORA. NÃO é aconselhamento jurídico — advogado revisa antes de
 * virar oficial. Ver `fortixx-saas-juridico` no vault.
 */
export default function PrivacidadePage() {
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
        <h1>Política de Privacidade</h1>
        <p className="legal-meta">Última atualização: 10 de setembro de 2026 · versão 1.0 · conforme Lei nº 13.709/2018 (LGPD)</p>

        <div className="legal-callout">
          <strong>Resumo:</strong> a Fortixx RH processa dados de colaboradores e candidatos <em>a mando da
          empresa contratante</em>. A empresa é a <strong>controladora</strong>; nós somos a
          <strong> operadora</strong>. Não vendemos dados, não usamos para treinar IA e não compartilhamos
          fora do necessário para o serviço funcionar.
        </div>

        <h2>1. Papéis</h2>
        <ul>
          <li><strong>Empresa cliente (controladora):</strong> decide quais dados de RH insere e por quê. Tem a base legal e o dever de informar os titulares.</li>
          <li><strong>Fortixx RH (operadora):</strong> trata esses dados só para prestar o serviço, conforme as instruções da controladora e esta Política.</li>
          <li><strong>Dados da própria conta</strong> (nome, e-mail, empresa, dados de cobrança e uso de quem administra a Fortixx): aqui a <strong>Fortixx é controladora</strong>.</li>
        </ul>

        <h2>2. Dados que tratamos</h2>
        <h3>Da conta / do administrador</h3>
        <ul>
          <li>identificação e contato (nome, e-mail, telefone, empresa, cargo);</li>
          <li>credenciais e fator de 2FA (senha é armazenada com hash, nunca em texto);</li>
          <li>dados de cobrança processados pelo provedor de pagamento (não guardamos número completo de cartão);</li>
          <li>logs de acesso, IP, registros de auditoria e uso da plataforma.</li>
        </ul>
        <h3>Inseridos pela empresa sobre colaboradores e candidatos</h3>
        <ul>
          <li>identificação e documentos (nome, CPF, RG, CNH, comprovantes) — inclusive por leitura automática (OCR) de arquivos enviados;</li>
          <li>dados profissionais (cargo, departamento, gestor, admissão, escalas, treinamentos);</li>
          <li>currículos, histórico de candidatura e anotações de recrutamento;</li>
          <li>eventualmente <strong>dados sensíveis</strong> (ex.: informação de saúde em atestado) — tratados apenas quando a controladora tem base legal e sob proteção reforçada.</li>
        </ul>

        <h2>3. Para que usamos</h2>
        <ul>
          <li>fornecer e manter as funcionalidades contratadas;</li>
          <li>autenticar, prevenir fraude e abuso, e manter a segurança (rate limiting, logs);</li>
          <li>dar suporte e comunicar avisos operacionais e de cobrança;</li>
          <li>cumprir obrigações legais e responder a autoridades.</li>
        </ul>
        <p>Não usamos os dados de RH da sua empresa para publicidade nem para treinar modelos de IA.</p>

        <h2>4. Assistente de RH e IA</h2>
        <p>
          Por padrão, o assistente responde por correspondência com as perguntas frequentes cadastradas
          pela sua empresa, sem enviar dados a terceiros. Se a empresa ativar o &ldquo;modo IA&rdquo; opcional,
          o texto da conversa é enviado ao provedor do modelo (Anthropic) apenas para gerar a resposta,
          sem ser usado para treino. A empresa controla se ativa esse modo.
        </p>

        <h2>5. Com quem compartilhamos (suboperadores)</h2>
        <p>Usamos prestadores essenciais para operar o serviço:</p>
        <ul>
          <li><strong>Vercel</strong> — hospedagem da aplicação;</li>
          <li><strong>Supabase</strong> — banco de dados, autenticação e armazenamento de arquivos;</li>
          <li><strong>Cakto / Stripe</strong> — processamento de pagamento;</li>
          <li><strong>Resend</strong> — envio de e-mails transacionais (quando ativado);</li>
          <li><strong>Anthropic</strong> — apenas se o &ldquo;modo IA&rdquo; do assistente estiver ativo.</li>
        </ul>
        <p>
          Parte desses serviços está fora do Brasil, o que implica <strong>transferência internacional</strong>.
          Ela é feita com base nas hipóteses da LGPD e em cláusulas contratuais de proteção com cada
          fornecedor. Não compartilhamos dados com mais ninguém, salvo por ordem legal.
        </p>

        <h2>6. Segurança</h2>
        <ul>
          <li>criptografia em trânsito (HTTPS/HSTS) e em repouso no provedor de banco;</li>
          <li>isolamento por empresa no banco (RLS — cada tenant só enxerga o próprio dado);</li>
          <li>2FA obrigatório, senhas com hash forte, sessões com expiração;</li>
          <li>rate limiting, cabeçalhos de segurança, trava contra uso da API por origem não autorizada;</li>
          <li>registros de auditoria de ações sensíveis.</li>
        </ul>
        <p>
          Nenhum sistema é 100% imune. Em caso de incidente de segurança relevante, notificamos a
          controladora sem demora injustificada para que ela cumpra os prazos da ANPD.
        </p>

        <h2>7. Retenção e eliminação</h2>
        <p>
          Mantemos os dados enquanto durar a relação contratual. Após o encerramento, a empresa tem
          <strong> 30 dias</strong> para exportar; depois, os dados são eliminados ou anonimizados, exceto o
          mínimo que a lei obrigue a reter (ex.: registros fiscais e de auditoria por prazo legal).
        </p>

        <h2>8. Direitos do titular</h2>
        <p>
          Colaboradores e candidatos exercem seus direitos (confirmação, acesso, correção,
          anonimização, portabilidade, eliminação, informação sobre compartilhamento) <strong>junto à
          empresa contratante</strong>, que é a controladora. Se a solicitação chegar a nós, encaminhamos à
          controladora e a apoiamos no atendimento. Para dados da própria conta, fale com
          <strong> [e-mail do encarregado / DPO]</strong>.
        </p>

        <h2>9. Cookies</h2>
        <p>
          Usamos apenas cookies necessários para login e segurança da sessão. Não usamos cookies de
          publicidade ou rastreamento de terceiros.
        </p>

        <h2>10. Encarregado (DPO) e contato</h2>
        <p>
          Encarregado pelo tratamento de dados: <strong>[nome]</strong> — <strong>[e-mail]</strong>.
          Dúvidas sobre esta Política: <strong>[e-mail de contato]</strong>.
        </p>

        <h2>11. Alterações</h2>
        <p>
          Podemos atualizar esta Política. Mudanças relevantes são comunicadas por e-mail ou aviso no
          painel. A data no topo indica a versão vigente.
        </p>

        <div className="legal-callout">
          <strong>Aviso:</strong> minuta para revisão jurídica. Preencher razão social, CNPJ, nome e
          e-mail do encarregado (DPO) e revisar a lista de suboperadores antes de publicar como oficial.
        </div>

        <p style={{ marginTop: 24 }}>
          <Link className="link-accent" href="/termos">← Ler os Termos de Uso</Link>
        </p>
      </article>
    </>
  );
}
