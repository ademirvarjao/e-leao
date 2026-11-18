import type {Article, Regime} from './types';

export const rateLaw = 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214compilado.htm';
export type Tax = 'CBS' | 'IBS';
export type RateReference = {
  tax: Tax; percent: string; from: string; until: string; article: string; scope: string;
};
// Nominal transition rates, not estimates of an effective tax burden or amounts payable.
const references: RateReference[] = [
  {tax:'CBS', percent:'0,9', from:'2026-01-01', until:'2026-12-31', article:'346', scope:'Alíquota de teste da União'},
  {tax:'IBS', percent:'0,1', from:'2026-01-01', until:'2026-12-31', article:'343', scope:'Alíquota de teste estadual'},
  {tax:'IBS', percent:'0,1', from:'2027-01-01', until:'2028-12-31', article:'344', scope:'Total: 0,05% estadual + 0,05% municipal'},
];
export function rateReference(tax: Tax, regime: Regime, date: string) {
  if (regime !== 'Regime regular' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==date) return;
  return references.find(r => r.tax === tax && date >= r.from && date <= r.until);
}
export function referenceLabel(r: RateReference) {
  return `${r.tax} ${r.percent}% · LC 214/2025, art. ${r.article} (${r.from} a ${r.until})`;
}
// This built-in source is shared by the calculator and the assistant. It isn't a DB article to vote on.
export const transitionGuide: Article = {
  id:'referencia-calculadora-transicao', category:'Referência da calculadora',
  question:'Quais são as alíquotas de teste de IBS e CBS em 2026?',
  answer:`Para fatos geradores de 2026, na regra geral sem redução, a referência de teste é CBS de ${references[0].percent}% (art. 346) e IBS estadual de ${references[1].percent}% (art. 343). Não são alíquotas do Simples Nacional. Reduções, exceções e a dispensa de recolhimento condicionada às obrigações acessórias devem ser verificadas no art. 348. Para 2027 e 2028, o art. 344 prevê IBS de 0,05% estadual e 0,05% municipal. Não extrapole a CBS de 2026 para outros anos. A simulação não determina imposto devido.`,
  source:rateLaw, keywords:'alíquotas aliquota percentual taxas teste 2026 2027 2028 CBS IBS transição regular',
};
