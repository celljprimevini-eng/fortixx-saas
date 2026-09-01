import Anthropic from '@anthropic-ai/sdk';

/**
 * Assistente RH — camada fina sobre a Claude API.
 *
 * O assistente responde dúvidas de RH dos colaboradores (férias, holerite,
 * ponto, benefícios, políticas) usando a base de FAQ do tenant como fonte de
 * verdade. Quando não sabe, quando o assunto é sensível, ou quando o
 * colaborador pede uma pessoa, ele sinaliza escalonamento em vez de inventar.
 *
 * Sem `ANTHROPIC_API_KEY` configurada, `askHrAssistant` lança
 * `HrAssistantUnavailableError` — as rotas/telas tratam isso mostrando um
 * estado "configure a chave" em vez de quebrar.
 */

export class HrAssistantUnavailableError extends Error {
  constructor() {
    super('Assistente RH indisponível: ANTHROPIC_API_KEY não configurada.');
    this.name = 'HrAssistantUnavailableError';
  }
}

/**
 * Modelo default: Claude Opus 5. Para esse tipo de tráfego (FAQ de alto volume,
 * respostas curtas) `claude-haiku-4-5` custa bem menos e costuma dar conta —
 * é só setar HR_ASSISTANT_MODEL no ambiente.
 */
const MODEL = process.env.HR_ASSISTANT_MODEL || 'claude-opus-5';

const ESCALATION_MARKER = '[[ESCALAR]]';

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

/**
 * Manda a conversa pro modelo e devolve a resposta + se deve escalar pra um
 * humano. `history` são as mensagens anteriores da thread (sem a atual);
 * `message` é a nova pergunta do colaborador.
 */
export async function askHrAssistant(params: {
  companyName: string;
  faqs: HrFaqEntry[];
  history: HrAssistantTurn[];
  message: string;
}): Promise<HrAssistantReply> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new HrAssistantUnavailableError();

  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [
    ...params.history.map((t) => ({ role: t.role, content: t.body })),
    { role: 'user' as const, content: params.message },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: 'low' },
    system: buildSystemPrompt(params.companyName, params.faqs),
    messages,
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  const escalate = raw.includes(ESCALATION_MARKER);
  const answer = raw.replace(ESCALATION_MARKER, '').trim()
    || 'Vou encaminhar isso pro time de RH — logo alguém te retorna.';

  return { answer, escalate };
}
