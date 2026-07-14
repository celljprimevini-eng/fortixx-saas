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
      <body>{children}</body>
    </html>
  );
}
