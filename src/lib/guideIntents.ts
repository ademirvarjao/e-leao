import {isRateTerm, normalizeTax, searchTerms} from './knowledge';
import type {Article} from './types';

const taxMention = /\b(?:ibs|cbs)\b/;
export const mentionsIbsCbs = (s:string) => taxMention.test(normalizeTax(s));

// Recognize a request about the taxes themselves, not just a sentence containing
// "o que é" and "IBS": "o que é crédito de IBS?" has a different subject.
const conceptCue = /\b(?:o que (?:e|eh|sao|seria|seriam)|siglas?|significa(?:m|dos?)?|quer(?:em)? dizer|defin(?:a|ir|icao|icoes)|conceitos?|explique|explicar?|diferencas?)\b/g;
const nouns = new Set('ibs cbs o a os as e ou imposto impostos tributo tributos'.split(' '));
const phrasing = new Set(('de da do das dos entre me voce vc pode poderia queria quero gostaria saber entender ' +
  'que qual quais esses dois mesmo melhor termo termos sobre').split(' '));
export function conceptIntent(question:string) {
  const text = normalizeTax(question)
    .replace(/\b(?:oq|o q|oque)\b/g,'o que')
    .replace(/\b(?:nao quero(?: saber)?|sem(?: falar)?) (?:d?[ao]s? |de )?(?:aliquota|taxas?)\b/g,' ')
    .replace(/\b(?:por favor|por gentileza|no brasil|(?:da|na) reforma tributaria|em (?:palavras|termos|linguagem) simples|de forma simples)\b/g,' ');
  const remainder = text.replace(conceptCue,' '), explicit = remainder !== text;
  const tokens:string[] = (explicit ? remainder.replace(/\b(?:em|para) 20\d{2}\b/g,' ') : remainder).match(/[a-z0-9]+/g) ?? [];
  const ibs = tokens.includes('ibs'), cbs = tokens.includes('cbs');
  if ((!ibs && !cbs) || !tokens.every(t => nouns.has(t) || (explicit && phrasing.has(t)))) return;
  const compare = /\bdiferencas?\b/.test(text);
  if (compare && !(ibs && cbs)) return; // "diferença de IBS" needs another subject.
  return {subject:ibs && cbs ? 'both' : ibs ? 'ibs' : 'cbs', compare} as const;
}

// The built-in reference is for ordinary nominal transition rates. Unknown
// qualifiers may be products, regimes or exceptions: don't give their general
// percentages as a specific answer. A curated guide can still match them.
const nominalWords = new Set(('ibs cbs teste transicao rtc regular regime nominal nominais referencia referencias padrao geral gerais ' +
  'federal estadual municipal parte uniao estado municipio ano anos vigente vigentes aplicavel aplicaveis aplicada aplicadas cobrada cobradas ' +
  'favor gentileza pra pro saber seria seriam fica ficam sera serao quanto quantos imposto impostos tributo tributos').split(' '));
export const inTransitionScope = (text:string) => (text.match(/\b(?:19|20)\d{2}\b/g) ?? []).every(year => ['2026','2027','2028'].includes(year));
export function asksTransitionRates(question:string, previous?:Article) {
  const plain = question.replace(/\bme (?:diga|informe)\b/gi,' ').replace(/\bsem redu[cç](?:[aã]o|[oõ]es)\b/gi,'geral');
  const text = normalizeTax(plain), terms = searchTerms(plain);
  if (!terms.some(isRateTerm) || !inTransitionScope(text) || /\b(?:nao|sem)\b/.test(text)) return false;
  if (!terms.every(t => isRateTerm(t) || nominalWords.has(t) || /^20\d{2}$/.test(t))) return false;
  // The reference has a nominal CBS value for 2026 only.
  if (/\bcbs\b/.test(text) && !/\bibs\b/.test(text) && /\b202[78]\b/.test(text) && !/\b2026\b/.test(text)) return false;
  // "E as alíquotas?" after a definition changes the intent. A year or a
  // pair of acronyms on its own is not evidence of a request for percentages.
  return taxMention.test(text) || /\b(?:teste|transicao|rtc)\b/.test(text) || !!(previous && mentionsIbsCbs(previous.question));
}
