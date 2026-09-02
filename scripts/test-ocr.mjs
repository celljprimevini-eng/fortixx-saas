#!/usr/bin/env node
/**
 * Testa o pipeline do digitalizador de documentos SEM navegador:
 * gera imagens sintéticas de RG/comprovante/contrato, roda o MESMO
 * Tesseract.js + traineddata que o dashboard usa, e aplica as MESMAS
 * funções classify()/parseDoc() do script.ts. Valida classificação,
 * extração de CPF/RG/nome e confiança.
 *
 * Uso: node scripts/test-ocr.mjs
 */

import { createCanvas } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import Tesseract from 'tesseract.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANG_PATH = join(ROOT, 'public', 'tesseract');
const CACHE = mkdtempSync(join(tmpdir(), 'ocrtest-'));

// ── funções copiadas 1:1 do script.ts (bloco DOCUMENT CAPTURE) ──────────────
const normalize = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
function classify(txt) {
  const u = normalize(txt).toUpperCase();
  if (/IDENTIDADE|REPUBLICA FEDERATIVA|REGISTRO GERAL|SECRETARIA DE SEGURANCA|CARTEIRA DE IDENT/.test(u)) return 'identidade';
  if (/COMPROVANTE|CONTA DE (LUZ|ENERGIA|AGUA)|FATURA|CEMIG|ENEL|COPEL|SABESP|LIGHT|EQUATORIAL/.test(u)) return 'comprovante';
  if (/CONTRATO|CLAUSULA|CONTRATANTE|CONTRATAD[OA]|RESCIS/.test(u)) return 'contrato';
  if (/CURRIC|CURRICULO|EXPERIENCIA PROFISSIONAL|FORMACAO ACADEMICA|OBJETIVO PROFISSIONAL/.test(u)) return 'curriculo';
  return 'outro';
}
function parseDoc(txt) {
  const clean = txt.replace(/[ \t]+/g, ' ');
  const cpf = (clean.match(/\b\d{3}\.?\s?\d{3}\.?\s?\d{3}\s?[-.]?\s?\d{2}\b/) || [null])[0];
  const rg = (clean.match(/\b\d{1,2}\.?\d{3}\.?\d{3}\s?-?\s?[\dxX]\b/) || [null])[0];
  const data = (clean.match(/\b\d{2}\/\d{2}\/\d{4}\b/) || [null])[0];
  let nome = null;
  const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const LABEL = /^(CONTRATAD[OA]|NOME|CLIENTE|TITULAR|BENEFICIARIO|BENEFICIÁRIO)\b\s*[:.\-]?\s*(.*)$/i;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LABEL);
    if (!m) continue;
    const inline = (m[2] || '').trim();
    nome = inline.length > 3 ? inline : (lines[i + 1] || null);
    if (nome) break;
  }
  if (!nome) {
    const cand = lines.find((l) => /^[A-ZÀ-Ú][A-ZÀ-Ú '.]{6,}$/.test(l) && l.split(' ').length >= 2 && !/REPUBLICA|IDENTIDADE|SECRETARIA|GERAL|FEDERATIVA|CONTRATO|CARTEIRA|FATURA|ENERGIA/.test(normalize(l).toUpperCase()));
    if (cand) nome = cand.replace(/\s{2,}/g, ' ');
  }
  return { cpf, rg, data, nome, doc: cpf || rg || null };
}

// ── gera uma imagem de documento com texto nítido ──────────────────────────
function docImage(lines) {
  const W = 900, H = 560;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f1e8';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#111';
  lines.forEach((ln, i) => {
    ctx.font = (ln.big ? 'bold 34px' : '26px') + ' Arial';
    ctx.fillText(ln.t, 50, 70 + i * 46);
  });
  return c.toBuffer('image/png');
}

const fixtures = [
  {
    nome: 'RG / identidade',
    esperado: { cat: 'identidade', cpf: '123.456.789-09', nome: 'MARIANA COSTA SILVA' },
    lines: [
      { t: 'REPUBLICA FEDERATIVA DO BRASIL', big: true },
      { t: 'CARTEIRA DE IDENTIDADE - REGISTRO GERAL' },
      { t: 'NOME' },
      { t: 'MARIANA COSTA SILVA' },
      { t: 'FILIACAO  JOAO SILVA  ANA COSTA' },
      { t: 'CPF  123.456.789-09' },
      { t: 'RG  12.345.678-9   DATA 04/07/1994' },
      { t: 'SECRETARIA DE SEGURANCA PUBLICA' },
    ],
  },
  {
    nome: 'Comprovante de residência',
    esperado: { cat: 'comprovante', nome: 'PEDRO' },
    lines: [
      { t: 'ENEL DISTRIBUICAO SAO PAULO', big: true },
      { t: 'FATURA DE ENERGIA ELETRICA' },
      { t: 'COMPROVANTE DE RESIDENCIA' },
      { t: 'CLIENTE  PEDRO HENRIQUE LIMA' },
      { t: 'RUA DAS ACACIAS 220  SAO PAULO SP' },
      { t: 'REFERENCIA  06/2026   VENCIMENTO 15/07/2026' },
      { t: 'VALOR TOTAL  R 187,45' },
    ],
  },
  {
    nome: 'Contrato de trabalho',
    esperado: { cat: 'contrato', nome: 'LUCAS' },
    lines: [
      { t: 'CONTRATO DE TRABALHO', big: true },
      { t: 'CONTRATANTE  FORTIXX DEMO LTDA' },
      { t: 'CONTRATADO  LUCAS PEREIRA GOMES' },
      { t: 'CLAUSULA PRIMEIRA - DO OBJETO' },
      { t: 'O presente contrato tem por objeto a prestacao' },
      { t: 'de servicos na funcao de Analista.' },
      { t: 'DATA DE ADMISSAO  01/03/2026' },
    ],
  },
];

let pass = 0, fail = 0;
const notes = [];

for (const fx of fixtures) {
  process.stdout.write(`→ ${fx.nome} ... `);
  const img = docImage(fx.lines);
  const { data } = await Tesseract.recognize(img, 'por', { langPath: LANG_PATH, cachePath: CACHE, gzip: true });
  const text = data.text || '';
  const conf = Math.round((data.confidence || 0) * 10) / 10;
  const cat = classify(text);
  const parsed = parseDoc(text);

  const okCat = cat === fx.esperado.cat;
  const okCpf = fx.esperado.cpf ? (parsed.cpf || '').replace(/\s/g, '') === fx.esperado.cpf : true;
  const okNome = fx.esperado.nome
    ? normalize(parsed.nome || '').toUpperCase().includes(fx.esperado.nome.split(' ')[0])
    : true;
  const okConf = conf >= 40;

  if (okCat && okCpf && okNome && okConf) {
    console.log(`OK  (tipo=${cat}, conf=${conf}%, cpf=${parsed.cpf || '-'}, nome=${parsed.nome || '-'})`);
    pass++;
  } else {
    console.log('FALHOU');
    if (!okCat) notes.push(`${fx.nome}: classificou como "${cat}", esperava "${fx.esperado.cat}"`);
    if (!okCpf) notes.push(`${fx.nome}: CPF lido "${parsed.cpf}" != "${fx.esperado.cpf}"`);
    if (!okNome) notes.push(`${fx.nome}: nome lido "${parsed.nome}" não bate com "${fx.esperado.nome}"`);
    if (!okConf) notes.push(`${fx.nome}: confiança ${conf}% muito baixa`);
    console.log('   texto OCR:\n' + text.split('\n').map((l) => '   | ' + l).join('\n'));
    fail++;
  }
}

console.log('\n' + '─'.repeat(50));
console.log(`${pass}/${fixtures.length} fixtures OK`);
if (notes.length) { console.log('\nNotas:'); notes.forEach((n) => console.log('  - ' + n)); }
process.exit(fail ? 1 : 0);
