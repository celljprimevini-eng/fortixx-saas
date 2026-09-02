import { NextResponse } from 'next/server';
import { landingStyle } from './_landing/style';
import { landingBody } from './_landing/body';
import { landingScript } from './_landing/script';

/**
 * Landing pública completa (protótipo "Liquid Glass" original, com storytelling,
 * partículas no hero, pricing, FAQ e modal de demonstração), recuperada da Lixeira
 * depois que a pasta do projeto foi apagada sem querer em 30/08. Servida como
 * documento HTML isolado (mesma estratégia usada em /dashboard/platform) em vez de
 * portada pra React, pra restaurar exatamente 1:1 sem risco de regressão visual.
 *
 * Único ajuste feito no HTML original: o link "Entrar" apontava pra
 * "fortixx-login.html" (arquivo estático que não existe neste projeto) — corrigido
 * pra "/auth/login". Todo o resto (CTAs com modal, âncoras de seção, placeholders
 * de rodapé) manteve exatamente o comportamento original.
 */
export const runtime = 'nodejs';

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>(function(){try{var t=localStorage.getItem('fortixx-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
<title>Fortixx — Sua plataforma de RH, do recrutamento ao dia a dia</title>
<meta name="description" content="Fortixx centraliza recrutamento, onboarding, comunicação interna e atendimento aos colaboradores em uma única plataforma de RH.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>${landingStyle}</style>
</head>
<body>
${landingBody}
<script>${landingScript}</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  });
}
