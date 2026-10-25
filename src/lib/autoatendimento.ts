import { createHash } from 'crypto';

/** Dias corridos entre duas datas AAAA-MM-DD, contando as duas pontas. */
export function inclusiveDays(start: string, end: string) {
  const a = Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10));
  const b = Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10));
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Hoje (AAAA-MM-DD) no fuso de São Paulo. */
export const todaySp = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

/** SHA-256 do conteúdo exato que vai ser assinado (título + texto). */
export const signatureHash = (title: string, content: string) =>
  createHash('sha256').update(`${title}\n${content}`, 'utf8').digest('hex');
