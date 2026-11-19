import {decimal, estimate, validDate} from './fiscal';
import {referenceLabel, type RateEntry, type Tax} from './rateReferences';
import {catalogLabel, catalogSource, isInCatalogPeriod, scenarioCode, suggestedRate, treatment, type Scenario} from './scenarios';
import type {Operation, Regime} from './types';

export const quickScope = 'Um item no mercado interno, entre particulares; base já ajustada, sem IS, créditos, diferimento ou tratamento especial adicional.';
type Input = {scenario?: Scenario; title:string; regime:Regime; date:string; base:string; cbs:RateEntry; ibs:RateEntry; confirmed:boolean; is?:{base:string; rate:string}};
export function simulate({scenario, title, regime, date, base, cbs, ibs, confirmed, is}: Input): Operation {
  if (!validDate(date)) throw Error('Informe uma data válida para o fato gerador.');
  if (!title.trim()) throw Error('Informe um nome para o cenário.');
  if (scenario && (!scenario.quick || !isInCatalogPeriod(scenario,date) || regime !== scenario.regime || !confirmed)) throw Error('Confira a vigência e as condições do cenário antes de calcular.');
  if (is && (regime !== 'Regime regular' || scenario)) throw Error('O IS manual requer um cenário personalizado do regime regular.');
  const values = estimate(base,cbs.value,ibs.value,is?.rate ?? '0',is?.base ?? '0');
  const details: Record<string,string> = {memoriaVersao:'1', origem:'Estimativa local; não é apuração oficial.', cbs:cbs.value, ibs:ibs.value};
  function record(tax: Tax, entry: RateEntry, key: string) {
    const ref = suggestedRate(tax,regime,date,scenario,confirmed);
    if (ref && entry.reference && entry.value === ref.percent && referenceLabel(entry.reference) === referenceLabel(ref)) details[key] = referenceLabel(ref);
    else if (scenario && ref && !decimal(entry.value,4,100).eq(ref.percent.replace(',','.'))) {
      const note = `${tax}: ${entry.value.replace('.',',')}% informado, referência do cenário ${ref.percent}%.`;
      details.divergencias = [details.divergencias,note].filter(Boolean).join(' ');
    }
  }
  record('CBS',cbs,'refCbs'); record('IBS',ibs,'refIbs');
  if (is) Object.assign(details,{isRate:is.rate, isBase:is.base, isBaseCents:decimal(is.base).times(100).toFixed(0)});
  if (scenario?.quick) Object.assign(details,{
    cenarioId:scenario.id, cenarioCodigo:scenarioCode(scenario), classificacao:scenario.name, catalogo:catalogLabel, catalogoFonte:catalogSource,
    tratamento:treatment(scenario.quick), premissas:`${scenario.quick.condition} ${quickScope}`, artigo:scenario.article,
  });
  const label = (scenario?.label ?? title).trim();
  return {id:crypto.randomUUID(), kind:'simulation', title:label.length <= 140 ? label : `${label.slice(0,139)}…`, regime, on_date:date,
    ...values, details, created_at:new Date().toISOString()};
}
