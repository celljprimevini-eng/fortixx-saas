import { Resend } from 'resend';

/**
 * Cliente Resend com fallback gracioso: se RESEND_API_KEY não estiver
 * configurada (ex: deploy sem Resend ainda), `sendEmail` apenas loga
 * e retorna sucesso simulado — o app continua funcionando, só não envia
 * e-mail real. Quando a key for configurada, volta a enviar normalmente.
 */
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailArgs) {
  // Fallback gracioso: sem Resend configurado, loga e finge sucesso.
  if (!resend) {
    console.warn(
      `[resend:disabled] E-mail não enviado (RESEND_API_KEY ausente). ` +
      `Para: ${to} | Assunto: ${subject}`
    );
    return { id: 'mock-' + Date.now(), disabled: true } as any;
  }

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Fortixx <noreply@fortixx.com>',
    to,
    subject,
    html,
  });
}

// ============================================================================
// Templates prontos para os eventos que o Fortixx já promete no front-end
// ============================================================================

export function candidateApprovedEmail(name: string, tempPasswordUrl: string) {
  return {
    subject: 'Parabéns! Você foi aprovado — bem-vindo(a) à equipe',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Parabéns, ${name}!</h2>
        <p>Você foi aprovado no nosso processo seletivo. Estamos muito felizes em ter você no time.</p>
        <p>Para acessar a plataforma e iniciar seu onboarding, defina sua senha:</p>
        <a href="${tempPasswordUrl}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;border-radius:8px;text-decoration:none">Definir minha senha</a>
      </div>
    `,
  };
}

export function scheduleChangedEmail(name: string, date: string, shift: string) {
  return {
    subject: 'Sua escala foi alterada',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Olá, ${name}</h2>
        <p>Sua escala do dia <strong>${date}</strong> foi atualizada para o turno: <strong>${shift}</strong>.</p>
        <p>Acesse a plataforma para confirmar a leitura.</p>
      </div>
    `,
  };
}

export function documentPendingEmail(name: string, documentType: string) {
  return {
    subject: 'Documento pendente de envio',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Olá, ${name}</h2>
        <p>Notamos que o documento <strong>${documentType}</strong> ainda está pendente. Envie assim que possível para não atrasar seu processo.</p>
      </div>
    `,
  };
}
