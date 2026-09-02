import type { Metadata } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display-google',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body-google',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-mono-google',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Fortixx — RH sem fricção',
  description:
    'Centralize recrutamento, onboarding e atendimento ao colaborador em um só lugar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/*
          Aplica o tema salvo (localStorage 'fortixx-theme') ANTES da primeira
          pintura, pra não piscar escuro→claro. O default continua escuro.
          Mesmo script está nos route.ts da landing e do dashboard.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('fortixx-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();",
          }}
        />
      </head>
      <body>
        {/*
          Filtro SVG referenciado por `.login-card::after` (globals.css) pra
          distorcer o brilho diagonal do card em login/verify/setup-2fa/etc.
          Estava faltando — a referência filter: url(#liquidDistort2fa) apontava
          pra um id que não existia em lugar nenhum do código, então o browser
          renderizava o gradiente diagonal cru (sem a distorção), aparecendo
          como uma linha reta cruzando o card. Fica no layout raiz porque
          .login-card é usado em várias páginas.
        */}
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <filter id="liquidDistort2fa" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" />
          </filter>
        </svg>
        {children}
      </body>
    </html>
  );
}
