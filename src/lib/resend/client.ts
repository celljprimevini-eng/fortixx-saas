import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailArgs) {
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

/**
 * Casca visual compartilhada por todos os e-mails: cabeçalho com a marca,
 * card central branco, rodapé discreto. Estilo em tabelas + inline CSS
 * (não classes/flex/grid) porque é o único jeito confiável de renderizar
 * igual em clientes de e-mail (Gmail, Outlook, Apple Mail).
 */
function emailShell(bodyHtml: string, preheader: string) {
  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    <body style="margin:0;padding:0;background:#F4F6FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FB;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
              <tr>
                <td style="padding-bottom:24px;text-align:center;">
                  <span style="display:inline-block;width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#FBBF24,#F59E0B);color:#1a1300;font-weight:700;font-size:16px;line-height:36px;text-align:center;">F</span>
                  <span style="display:inline-block;margin-left:10px;font-weight:700;font-size:17px;color:#0F172A;vertical-align:middle;">Fortixx</span>
                </td>
              </tr>
              <tr>
                <td style="background:#FFFFFF;border-radius:20px;padding:36px 32px;box-shadow:0 1px 2px rgba(15,23,42,0.04),0 8px 20px rgba(15,23,42,0.06);">
                  ${bodyHtml}
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;text-align:center;font-size:12px;color:#94A3B8;line-height:1.6;">
                  Você está recebendo este e-mail porque faz parte da equipe na plataforma Fortixx.<br />
                  Fortixx — RH sem fricção
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  `;
}

function emailButton(url: string, label: string) {
  return `
    <a href="${url}" style="display:inline-block;padding:13px 28px;background:#2563EB;color:#ffffff;border-radius:100px;text-decoration:none;font-weight:600;font-size:14px;">${label}</a>
  `;
}

export function candidateApprovedEmail(name: string, tempPasswordUrl: string) {
  const firstName = name.split(' ')[0];
  const body = `
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#B8860B;">Boas-vindas</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0F172A;">Parabéns, ${firstName}! 🎉</h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155;">
      Temos uma ótima notícia: você foi aprovado(a) no nosso processo seletivo e a partir de agora faz parte da equipe. Ficamos muito felizes em ter você com a gente!
    </p>
    <p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:#334155;">
      O próximo passo é criar sua senha de acesso e dar início ao seu onboarding — vai levar só um minuto.
    </p>
    <div style="text-align:center;margin:0 0 8px;">
      ${emailButton(tempPasswordUrl, 'Definir minha senha e começar')}
    </div>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#94A3B8;">
      Se você não esperava este e-mail, pode ignorá-lo com segurança.
    </p>
  `;
  return {
    subject: `${firstName}, parabéns pela aprovação na equipe! 🎉`,
    html: emailShell(body, `${firstName}, você foi aprovado! Defina sua senha para começar.`),
  };
}

export function scheduleChangedEmail(name: string, date: string, shift: string) {
  const firstName = name.split(' ')[0];
  const body = `
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#2563EB;">Escala atualizada</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0F172A;">Oi, ${firstName} — sua escala mudou</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#334155;">
      Só um aviso rápido: sua escala do dia <strong style="color:#0F172A;">${date}</strong> foi atualizada para o turno <strong style="color:#0F172A;">${shift}</strong>.
    </p>
    <p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:#334155;">
      Dá uma olhada na plataforma e confirma que recebeu essa mudança, assim seu time já sabe que está tudo certo.
    </p>
    <div style="text-align:center;">
      ${emailButton(process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard` : '#', 'Confirmar leitura')}
    </div>
  `;
  return {
    subject: `Sua escala do dia ${date} foi atualizada`,
    html: emailShell(body, `Sua escala de ${date} agora é ${shift}.`),
  };
}

export function documentPendingEmail(name: string, documentType: string) {
  const firstName = name.split(' ')[0];
  const body = `
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#B8860B;">Falta pouco</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0F172A;">${firstName}, um documento está te esperando</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#334155;">
      Notamos que o documento <strong style="color:#0F172A;">${documentType}</strong> ainda não chegou até nós. Sem ele, seu onboarding fica em pausa — mas é rapidinho de resolver.
    </p>
    <p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:#334155;">
      Envia assim que puder pra gente seguir com tudo em dia.
    </p>
    <div style="text-align:center;">
      ${emailButton(process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard` : '#', 'Enviar documento agora')}
    </div>
  `;
  return {
    subject: `Falta enviar: ${documentType}`,
    html: emailShell(body, `O documento ${documentType} ainda está pendente.`),
  };
}

export function paymentFailedEmail(tenantName: string) {
  const body = `
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#DC2626;">Pagamento não concluído</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0F172A;">Não conseguimos processar seu pagamento</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#334155;">
      Olá! Tentamos cobrar a assinatura da <strong style="color:#0F172A;">${tenantName}</strong> na Fortixx, mas o pagamento não passou. Isso pode acontecer por cartão vencido, limite ou uma recusa do banco.
    </p>
    <p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:#334155;">
      Atualiza os dados de pagamento pra manter o acesso da sua equipe sem interrupção.
    </p>
    <div style="text-align:center;">
      ${emailButton(process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/configuracoes` : '#', 'Atualizar pagamento')}
    </div>
  `;
  return {
    subject: 'Ação necessária: pagamento da Fortixx não foi concluído',
    html: emailShell(body, `O pagamento da ${tenantName} não foi processado.`),
  };
}
