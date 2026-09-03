/**
 * Parsing de currículo — substitui o workflow n8n `resume-parse` (que
 * precisava de conta n8n paga/config). Roda no servidor, de graça:
 *
 *  - PDF   → texto via `unpdf` (pdf.js serverless, sem dependência nativa)
 *  - imagem → OCR via `tesseract.js` (Node)
 *  - texto  → como veio
 *
 * Depois extrai e-mail, telefone e skills do texto por regex + lista de
 * palavras-chave. Best-effort: se algo falhar, devolve o que conseguiu.
 */

import { extractText, getDocumentProxy } from 'unpdf';

const SKILLS = [
  // técnicas
  'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'go', 'golang', 'rust', 'php', 'ruby', 'kotlin', 'swift',
  'react', 'next.js', 'nextjs', 'vue', 'angular', 'svelte', 'node.js', 'nodejs', 'express', 'nestjs', 'django', 'flask',
  'spring', 'laravel', '.net', 'rails',
  'sql', 'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'supabase', 'firebase', 'prisma',
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'ci/cd', 'git', 'linux',
  'html', 'css', 'tailwind', 'sass', 'figma',
  'power bi', 'excel', 'looker', 'tableau', 'bigquery', 'etl', 'pandas', 'numpy',
  // negócio / RH / comercial
  'recrutamento', 'seleção', 'recrutamento e seleção', 'departamento pessoal', 'folha de pagamento', 'e-social', 'esocial',
  'onboarding', 'treinamento e desenvolvimento', 'clima organizacional', 'benefícios', 'clt',
  'vendas', 'prospecção', 'inside sales', 'outbound', 'crm', 'salesforce', 'hubspot', 'pipedrive', 'negociação',
  'gestão de projetos', 'scrum', 'kanban', 'jira', 'okr', 'lgpd',
  'atendimento ao cliente', 'suporte', 'sac', 'logística', 'estoque', 'compras',
  'contas a pagar', 'contas a receber', 'conciliação bancária', 'fluxo de caixa', 'contabilidade',
  // idiomas
  'inglês', 'espanhol', 'português', 'inglês avançado', 'inglês fluente', 'espanhol avançado',
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s-]?)?(?:9\s?)?\d{4}[\s-]?\d{4}/;

export interface ResumeParseResult {
  raw_text: string;
  email: string | null;
  phone: string | null;
  skills: string[];
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function extractFields(text: string): Omit<ResumeParseResult, 'raw_text'> {
  const email = text.match(EMAIL_RE)?.[0]?.toLowerCase() ?? null;
  const phone = text.match(PHONE_RE)?.[0]?.replace(/\s+/g, ' ').trim() ?? null;

  const hay = normalize(text);
  const skills = SKILLS.filter((sk) => hay.includes(normalize(sk)))
    // dedup casos tipo "inglês" e "inglês avançado" — mantém o mais específico
    .filter((sk, _i, arr) => !arr.some((o) => o !== sk && normalize(o).includes(normalize(sk)) && o.length > sk.length))
    .slice(0, 25);

  return { email, phone, skills };
}

async function textFromPdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : String(text ?? '');
}

async function textFromImage(buffer: Buffer): Promise<string> {
  // Import dinâmico: só carrega o tesseract quando é imagem de verdade.
  const Tesseract = (await import('tesseract.js')).default;
  const { data } = await Tesseract.recognize(buffer, 'por+eng');
  return data.text ?? '';
}

/**
 * @param buffer   conteúdo do arquivo
 * @param mimeType content-type (ou nome do arquivo pra inferir)
 */
export async function parseResume(buffer: Buffer, mimeType: string): Promise<ResumeParseResult> {
  const mt = mimeType.toLowerCase();
  let raw = '';
  try {
    if (mt.includes('pdf')) raw = await textFromPdf(buffer);
    else if (mt.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(mt)) raw = await textFromImage(buffer);
    else raw = buffer.toString('utf8').slice(0, 20000); // txt / rtf simples
  } catch (err) {
    console.error('[parse-resume] falha ao extrair texto:', err);
  }

  raw = raw.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 20000);
  return { raw_text: raw, ...extractFields(raw) };
}
