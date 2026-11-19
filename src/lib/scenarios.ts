import Decimal from 'decimal.js';
import catalog from '../data/rtc-catalog.json';
import {validDate} from './fiscal';
import {rateReference, type RateReference, type Tax} from './rateReferences';
import type {Regime} from './types';

export const catalogLabel = `Receita Federal · RTC ${catalog.version} · base ${catalog.reference.version}`;
export const catalogSource = `https://github.com/ReceitaFederal/calculadora-rtc-regime-regular/tree/${catalog.revision}/flyway/sql`;
export type Scenario = {
  id: string; family: 'ibsCbs' | 'is' | 'sn'; code: string; name: string; label: string;
  documents: number[]; rtcTreatment?: string; requiresRegular?: boolean; nominalGroup?: boolean; cst?: string; nomenclature?: string; article: string; group: string; from: string; until: string | null;
  regime: Regime; guidance: string; quick?: QuickRule;
};
type QuickRule = {reduction: 0 | 30 | 60 | 100; condition: string; label?: string};
// Positive allowlist: only one adjusted base and an ad valorem rate per tax. Not a
// classifier. Never derive a percentage from a CST, a sector name or an RTC fixture.
const quickRules: Record<string, QuickRule | undefined> = {
  '000001': {reduction:0, condition:'Operação interna onerosa entre particulares, integralmente tributada no regime regular, sem benefício, tratamento específico ou IS.'},
  '200003': {reduction:100, label:'Cesta básica nacional · alimentos do Anexo I', condition:'O produto se destina à alimentação humana e sua descrição e NCM/SH constam do Anexo I. Nem todo alimento compõe a cesta básica.'},
  '200004': {reduction:100, condition:'Dispositivo médico relacionado no Anexo XII, com NCM/SH correspondente e regularização perante a Anvisa.'},
  '200013': {reduction:100, label:'Saúde menstrual · produtos do art. 147', condition:'O produto está entre os itens do art. 147, com a NCM/SH correspondente e os requisitos da Anvisa atendidos.'},
  '200014': {reduction:100, label:'Hortícolas, frutas e ovos · Anexo XV', condition:'Confira descrição, NCM/SH no Anexo XV e formas de apresentação admitidas pelo art. 148.'},
  '200028': {reduction:60, label:'Serviços de educação · Anexo II', condition:'O serviço e sua NBS constam do Anexo II. A base inclui só o serviço de educação enquadrado, sem receitas acessórias ou tratamento do Prouni.'},
  '200029': {reduction:60, label:'Serviços de saúde humana · Anexo III', condition:'O serviço prestado e a respectiva NBS constam do Anexo III. Plano de saúde não se enquadra automaticamente nesta regra.'},
  '200030': {reduction:60, condition:'Dispositivo médico regularizado perante a Anvisa, listado com sua NCM/SH no Anexo IV, fora das hipóteses de alíquota zero.'},
  '200031': {reduction:60, condition:'Dispositivo de acessibilidade listado no Anexo V, com NCM/SH e requisitos técnicos atendidos, fora das hipóteses de alíquota zero.'},
  '200032': {reduction:60, condition:'Medicamento registrado na Anvisa ou produzido por farmácia de manipulação. Confira os requisitos do art. 133 e descarte as hipóteses de alíquota zero do art. 146.'},
  '200034': {reduction:60, label:'Alimentos para consumo humano · Anexo VII', condition:'Confira a descrição e a NCM/SH no Anexo VII. Não confunda esta lista com os alimentos de alíquota zero do Anexo I.'},
  '200035': {reduction:60, label:'Higiene pessoal e limpeza · Anexo VIII', condition:'O produto e a respectiva NCM/SH constam do Anexo VIII. O setor de higiene e limpeza, por si só, não dá direito à redução.'},
  '200036': {reduction:60, condition:'Produto in natura nos termos do art. 137, atendidas as condições de processamento e apresentação. Confira se não há hipótese de alíquota zero.'},
  '200052': {reduction:30, label:'Profissões intelectuais regulamentadas · art. 127', condition:'Profissão listada no art. 127, atividade sujeita à fiscalização de conselho e requisitos do prestador (pessoa física ou sociedade) atendidos.'},
};
function guidance(family: Scenario['family'], cst: string) {
  if (family === 'is') return 'Confira a incidência sobre o bem ou serviço, a vigência legal, a unidade, a base e as alíquotas próprias do IS. A classificação do item para IBS/CBS é independente.';
  if (cst === '620') return 'Na monofasia de combustíveis, confira produto, quantidade, unidade e etapa de retenção. Uma porcentagem do preço não representa essa operação.';
  if (['400','410','510','515','550'].includes(cst)) return 'Confira a hipótese legal, o destinatário, a destinação e o documento. Isenção, imunidade, diferimento e suspensão têm efeitos diferentes; não informe 0% só pelo nome.';
  if (cst.startsWith('8')) return 'Confira o documento próprio e as condições do ajuste ou crédito. Nem todas as situações do catálogo estão implementadas pelo motor.';
  return 'Confira a classificação, as condições do artigo, a composição da base e o documento da operação. A estimativa rápida não reproduz todas as regras deste item.';
}
const classes: Scenario[] = (['ibsCbs','is'] as const).flatMap(family => catalog[family].map(row => {
  const quick = family === 'ibsCbs' ? quickRules[row.code] : undefined;
  const article = row.article === 'LC 214/2025' ? 'arts. 4º e 12' : row.article;
  return {...row, family, id:`${family}:${row.code}`, label:quick?.label ?? row.name, article,
    regime:'Regime regular' as const, group:`${family === 'is' ? 'IS' : 'IBS/CBS'} · CST ${row.cst} · ${row.category}`,
    guidance:quick?.condition ?? guidance(family,row.cst), quick};
}));
// Everyday names for onerous supplies (art. 4º, § 2º), not additional official codes.
const general = classes.find(s => s.id === 'ibsCbs:000001')!;
const common: Scenario[] = [
  ['venda','Venda de mercadoria no mercado interno'], ['servico','Prestação de serviço no mercado interno'],
  ['locacao','Locação de bem móvel'], ['licenca','Licenciamento ou cessão onerosa de direito'],
  ['permuta','Permuta de bens'],
].map(([key,name]) => ({...general, id:`comum:${key}`, label:`${name} · regra geral`, group:'Operações usuais · tributação integral'}));
const activities: Scenario[] = catalog.sn.map(row => ({...row, family:'sn', id:`sn:${row.code}`, label:row.name,
  article:'art. 18', group:'Simples Nacional · atividades (cAtivSN)', regime:'Simples Nacional',
  guidance:`Indicação do catálogo: ${row.annex === 'Não tributável' ? row.annex : 'anexo '+row.annex}. Confira documento, CRT, cClassTrib, receita acumulada, faixa e fator R quando aplicável. A atividade isolada não define o percentual efetivo nem o DAS.`}));
export const scenarios: Scenario[] = [...common, ...classes, ...activities];
export const documentLabels: Record<string,string> = catalog.documents;
export const documentOptions = (s: Scenario) => s.documents.map(code=>`${documentLabels[code]} (${code})`).join(', ');
export const isInCatalogPeriod = (s: Scenario, date: string) => validDate(date) && date >= s.from && (!s.until || date <= s.until);
export const scenarioCode = (s: Scenario) => s.family === 'sn' ? `cAtivSN ${s.code}` : `${s.family === 'is'?'IS':'IBS/CBS'} · CST ${s.cst} · cClassTrib ${s.code}`;
export function treatment(rule: QuickRule) {
  return rule.reduction === 0 ? 'Tributação integral' : rule.reduction === 100 ? 'Alíquota zero para IBS e CBS' : `Redução de ${rule.reduction}% da alíquota de IBS e CBS (não da base)`;
}
// This function is the only source of quick suggestions. No fallback to the general
// rate for an unsupported, unconfirmed, expired or regime-incompatible scenario.
export function suggestedRate(tax: Tax, regime: Regime, date: string, scenario?: Scenario, confirmed = false): RateReference | undefined {
  const nominal = rateReference(tax,regime,date);
  if (!scenario) return nominal;
  if (!scenario.quick || !confirmed || scenario.regime !== regime || !isInCatalogPeriod(scenario,date)) return;
  const {reduction} = scenario.quick;
  // A statutory zero does not depend on knowing a nominal CBS. Bound the local
  // suggestion window explicitly; its end is NOT a sunset clause of the law.
  if (reduction === 100 && date >= '2026-01-01' && date <= '2028-12-31') return {
    tax, percent:'0', from:'2026-01-01', until:'2028-12-31', article:scenario.article.replace(/^Art\.\s*/i,''),
    scope:'Redução a zero para a operação enquadrada; independe da alíquota nominal',
  };
  if (!nominal || !reduction) return nominal;
  const percent = new Decimal(nominal.percent.replace(',','.')).times(100-reduction).div(100).toString().replace('.',',');
  return {...nominal, percent,
    article:`${nominal.article}${date < '2027' ? '; art. 348, III, a' : ', parágrafo único, I'}; ${scenario.article}`,
    scope:`${nominal.scope}: ${nominal.percent}% × (1 − ${reduction}%) = ${percent}%`};
}
