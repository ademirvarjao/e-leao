import {isInCatalogPeriod, type Scenario} from './scenarios';
import type {Engine} from './rtc';

// Deliberately incomplete, editable contract starter. A classification is not a
// taxpayer, place, NCM/NBS, rate or base; never borrow those from an example.
const fill = (field: string) => `<informar ${field}>`;
export const hasPlaceholders = (text: string) => text.includes('<informar ');
export type ScenarioPacket = {engine: Engine; operation: object};
export function scenarioPacket(s: Scenario, date: string): ScenarioPacket | undefined {
  if (!isInCatalogPeriod(s,date)) return;
  const id = crypto.randomUUID();
  if (s.family === 'sn') return {engine:'simple', operation:{id, versao:'2.0.0', data:date,
    tpDoc:s.documents.length === 1 ? String(s.documents[0]) : fill('modelo do documento'), CRT:fill('CRT do emitente'),
    itens:[{numero:1, cAtivSN:s.code, cClassTrib:fill('cClassTrib IBS/CBS'), baseCalculo:fill('base sem IS, decimal como texto'),
      valorImpostoSeletivo:fill('IS já calculado, decimal como texto'), pIBSSN:fill('percentual efetivo se exigido'), pCBSSN:fill('percentual efetivo se exigido')} ]}};
  const is = s.family === 'is';
  const item = {numero:1, cst:is ? fill('CST IBS/CBS') : s.cst, cClassTrib:is ? fill('cClassTrib IBS/CBS') : s.code,
    ...(s.nomenclature === 'NBS' ? {nbs:fill('NBS do serviço')} : s.nomenclature === 'Não possui' ? {} : {ncm:fill(s.nomenclature === 'NCM' ? 'NCM do bem' : 'NCM ou trocar este campo por nbs, conforme o item')}),
    ...(s.cst==='620' ? {quantidade:fill('quantidade do combustível'),unidade:fill('unidade de medida')} : {}),
    ...(s.requiresRegular ? {tributacaoRegular:{cst:fill('CST da tributação regular de comparação'),cClassTrib:fill('cClassTrib da tributação regular de comparação')}} : {}),
    ...(is ? {impostoSeletivo:{cst:s.cst, cClassTrib:s.code, quantidade:fill('quantidade se aplicável'), unidade:fill('unidade se aplicável'), baseCalculo:fill('base própria do IS')}} : {baseCalculo:fill('base ajustada do item')}),
    ...(date >= '2027-01-01' ? {aliquotasNominais:{cbs:fill('CBS nominal'), ibsEstadual:fill('IBS estadual nominal'), ibsMunicipal:fill('IBS municipal nominal'),
      ...(is ? {impostoSeletivo:{adValorem:fill('alíquota ad valorem se aplicável'), adRem:fill('alíquota específica se aplicável')}} : {})}} : {}),
  };
  return {engine:'regular', operation:{id, versao:'1.0.0', dhFatoGerador:`${date}T${fill('hora e fuso')}`, ...(s.documents.length === 1 ? {tpDoc:s.documents[0]} : {}), municipio:fill('código IBGE numérico'), uf:fill('UF do fato gerador'), itens:[item]}};
}
