import { NextResponse } from 'next/server';
import { platformStyle } from '../_platform/style';
import { platformBody } from '../_platform/body';
import { platformScript } from '../_platform/script';

/**
 * Serve o dashboard "Plataforma de RH" completo (o protótipo fortixx-plataforma.html
 * que a Renata validou) como um documento HTML isolado, carregado num iframe por
 * /dashboard. Fica isolado de propósito: é uma UI vanilla HTML/CSS/JS gigante e
 * auto-suficiente — portar módulo a módulo pra React é o próximo passo, não um
 * bloqueio pra já estar rodando dentro do app real.
 *
 * Protegido pelo mesmo middleware que protege /dashboard/* (login + AAL2).
 */
export const runtime = 'nodejs';

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Fortixx — Plataforma de RH</title>
<meta name="theme-color" content="#0A0A0A" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#FAFAFA" media="(prefers-color-scheme: light)">
<meta name="color-scheme" content="dark light">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>${platformStyle}</style>
</head>
<body>
${platformBody}
<script>${platformScript}</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
