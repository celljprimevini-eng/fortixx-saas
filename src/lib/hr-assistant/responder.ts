/**
 * Assistente RH — responde dúvidas de RH dos colaboradores.
 *
 * Dois modos, escolhidos automaticamente:
 *
 *  1. **FAQ (default, sem custo)** — casa a pergunta do colaborador com a base
 *     `hr_faqs` do tenant por sobreposição de palavras (ignora acento, pontuação
 *     e palavras vazias). Acima do limiar, devolve a resposta cadastrada; abaixo,
 *     sinaliza escalonamento pra uma pessoa do RH. Determinístico, roda offline,
 *     não depende de chave nenhuma.
 *
 *  2. **IA (opcional)** — se `ANTHROPIC_API_KEY` estiver no ambiente, usa a Claude
 *     API com a mesma base de FAQ como contexto, pra respostas mais naturais e
 *     que lidam com perguntas fora da base. É um upgrade, não um requisito.
 *
 * A tela e a API não precisam saber qual modo rodou — o retorno é o mesmo.
 */

const ESCALATION_MARKER = '[[ESCALAR]]';

/** Modelo usado só no modo IA. Default Opus 5; `claude-haiku-4-5` custa menos. */
const AI_MODEL = process.env.HR_ASSISTANT_MODEL || 'claude-opus-5';

export interface HrFaqEntry {
  question: string;
  answer: string;
}

export interface HrAssistantTurn {
  role: 'user' | 'assistant';
  body: string;
}

export interface HrAssistantReply {
  answer: string;
  escalate: boolean;
  /** 'faq' | 'ia' — útil pra log/debug, a UI ignora. */
  mode: 'faq' | 'ia';
}

const STOPWORDS = new Set([
  'a', 'o', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'ou',
  'que', 'em', 'no', 'na', 'nos', 'nas', 'para', 'pra', 'por', 'com', 'sem',
  'meu', 'minha', 'meus', 'minhas', 'eu', 'me', 'se', 'ao', 'aos', 'como',
  'qual', 'quais', 'quando', 'onde', 'quanto', 'quantos', 'quantas',
  'ser', 'tem', 'ter', 'tenho', 'temos', 'vou', 'ja', 'ainda', 'fazer',
  'faco', 'isso', 'esse', 'essa', 'este', 'esta', 'aqui', 'ali', 'sobre',
  'preciso', 'quero', 'gostaria', 'poderia', 'pode', 'nao', 'sim', 'ok',
  'the', 'is', 'are', 'my', 'how', 'what', 'where',
]);

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Score de 0 a 1: quão bem as palavras significativas da pergunta do
 * colaborador batem com as palavras da FAQ (pergunta + resposta juntas). O
 * texto da resposta entra porque é onde estão os termos concretos ("holerite",
 * "dia 5", "atestado"...) que o colaborador tende a usar.
 */
function matchScore(askedTokens: string[], faqTokens: Set<string>): number {
  if (askedTokens.length === 0) return 0;
  const hits = askedTokens.filter((t) => faqTokens.has(t)).length;
  return hits / askedTokens.length;
}

function faqReply(faqs: HrFaqEntry[], message: string): HrAssistantReply {
  const asked = normalize(message);
  let best: { faq: HrFaqEntry; score: number } | null = null;
  for (const faq of faqs) {
    const faqTokens = new Set([...normalize(faq.question), ...normalize(faq.answer)]);
    const score = matchScore(asked, faqTokens);
    if (!best || score > best.score) best = { faq, score };
  }

  // ~1/3 das palavras-chave da pergunta batem com a FAQ. Abaixo disso é mais
  // seguro escalar do que arriscar responder a FAQ errada.
  if (best && best.score >= 0.33) {
    return { answer: best.faq.answer, escalate: false, mode: 'faq' };
  }
  return {
    answer: 'Não encontrei isso na base de conhecimento — vou encaminhar pro time de RH e logo alguém te retorna.',
    escalate: true,
    mode: 'faq',
  };
}

function buildSystemPrompt(companyName: string, faqs: HrFaqEntry[]): string {
  const kb = faqs.length
    ? faqs.map((f, i) => `${i + 1}. P: ${f.question}\n   R: ${f.answer}`).join('\n')
    : '(a base de conhecimento ainda está vazia)';
  return [
    `Você é o assistente de RH da empresa ${companyName}, dentro da plataforma Fortixx.`,
    'Responde dúvidas de colaboradores sobre RH: férias, holerite, ponto, benefícios, documentos e políticas internas.',
    '',
    'Regras:',
    '- Responda em português do Brasil, tom direto e cordial, no máximo 2 parágrafos curtos.',
    '- Use a base de conhecimento abaixo como fonte de verdade. Não invente política, prazo ou valor que não esteja nela.',
    `- Se a dúvida não estiver coberta pela base, se envolver dado pessoal/financeiro específico da pessoa, se for uma reclamação, ou se o colaborador pedir falar com alguém do RH, responda com uma frase curta reconhecendo o pedido e termine a mensagem com a linha isolada ${ESCALATION_MARKER}.`,
    `- Nunca escreva ${ESCALATION_MARKER} quando você conseguiu responder de fato pela base.`,
    '',
    'Base de conhecimento:',
    kb,
  ].join('\n');
}

async function aiReply(params: {
  companyName: string;
  faqs: HrFaqEntry[];
  history: HrAssistantTurn[];
  message: string;
}): Promise<HrAssistantReply> {
  // Import dinâmico: o pacote só é carregado quando há chave configurada.
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    output_config: { effort: 'low' },
    system: buildSystemPrompt(params.companyName, params.faqs),
    messages: [
      ...params.history.map((t) => ({ role: t.role, content: t.body })),
      { role: 'user' as const, content: params.message },
    ],
  });

  const raw = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  const escalate = raw.includes(ESCALATION_MARKER);
  const answer = raw.replace(ESCALATION_MARKER, '').trim()
    || 'Vou encaminhar isso pro time de RH — logo alguém te retorna.';
  return { answer, escalate, mode: 'ia' };
}

/**
 * Ponto de entrada único. Nunca lança por falta de configuração: sem
 * `ANTHROPIC_API_KEY` cai no modo FAQ; se a chamada de IA falhar (ex: sem
 * crédito na conta), também cai no FAQ em vez de quebrar o atendimento.
 */
export async function askHrAssistant(params: {
  companyName: string;
  faqs: HrFaqEntry[];
  history: HrAssistantTurn[];
  message: string;
}): Promise<HrAssistantReply> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return faqReply(params.faqs, params.message);
  }
  try {
    return await aiReply(params);
  } catch {
    // Chave presente mas indisponível (sem crédito, rate limit, rede) —
    // degrada pro FAQ silenciosamente. O colaborador ainda é atendido.
    return faqReply(params.faqs, params.message);
  }
}
