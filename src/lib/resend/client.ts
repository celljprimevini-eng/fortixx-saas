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
// escapeHtml — protege contra XSS em emails (clientes de email podem
// renderizar HTML, então interpolamos dados do usuário em HTML cru).
// ============================================================================
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

// ============================================================================
// Templates prontos para os eventos que o Fortixx já promete no front-end
// ============================================================================

export function candidateApprovedEmail(name: string, tempPasswordUrl: string) {
  // tempPasswordUrl vem de admin.auth.generateLink() — Supabase Auth —
  // então é uma URL https legítima. Mesmo assim, escapamos pra defense
  // in depth (atributo href não escapa javascript: em alguns clientes).
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(tempPasswordUrl);
  return {
    subject: 'Parabéns! Você foi aprovado — bem-vindo(a) à equipe',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Parabéns, ${safeName}!</h2>
        <p>Você foi aprovado no nosso processo seletivo. Estamos muito felizes em ter você no time.</p>
        <p>Para acessar a plataforma e iniciar seu onboarding, defina sua senha:</p>
        <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;border-radius:8px;text-decoration:none">Definir minha senha</a>
      </div>
    `,
  };
}

export function scheduleChangedEmail(name: string, date: string, shift: string) {
  const safeName = escapeHtml(name);
  const safeDate = escapeHtml(date);
  const safeShift = escapeHtml(shift);
  return {
    subject: 'Sua escala foi alterada',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Olá, ${safeName}</h2>
        <p>Sua escala do dia <strong>${safeDate}</strong> foi atualizada para o turno: <strong>${safeShift}</strong>.</p>
        <p>Acesse a plataforma para confirmar a leitura.</p>
      </div>
    `,
  };
}

export function documentPendingEmail(name: string, documentType: string) {
  const safeName = escapeHtml(name);
  const safeDocType = escapeHtml(documentType);
  return {
    subject: 'Documento pendente de envio',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Olá, ${safeName}</h2>
        <p>Notamos que o documento <strong>${safeDocType}</strong> ainda está pendente. Envie assim que possível para não atrasar seu processo.</p>
      </div>
    `,
  };
}
