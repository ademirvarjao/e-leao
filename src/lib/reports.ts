import {readableDate} from './fiscal';
import {lc123,lc214} from './legal';
import {rtcStatus,services,type Engine} from './rtc';
import type {Operation} from './types';

export type Row = [label:string,value:string|number,unit?:'BRL'|'%'];
export type ReportSection = {title:string;rows:Row[]};
export type Report = {title:string;filename:string;summary:string;sections:ReportSection[]};
export const disclaimer = 'Relatório informativo do e-Leão. Não é documento fiscal, apuração oficial nem guia de recolhimento.';
export const hasSimulationMemory = (o:Operation) => o.kind==='simulation' && o.details.memoriaVersao==='1' &&
  Object.values(o.details).every(v=>typeof v==='string') && [o.details.cbs,o.details.ibs,...(o.details.isRate===undefined?[]:[o.details.isRate])].every(v=>typeof v==='string'&&/^\d+(?:[,.]\d{1,4})?$/.test(v)) &&
  (o.details.isRate===undefined || /^\d{1,11}$/.test(o.details.isBaseCents));
export function displayValue([,value,unit]:Row){
  if(typeof value==='string')return value;
  if(unit==='BRL')return value.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:8});
  return value.toLocaleString('pt-BR',{maximumFractionDigits:10})+(unit==='%'?'%':'');
}
export function simulationReport(o:Operation):Report {
  const d=o.details, versioned=hasSimulationMemory(o);
  const sections:ReportSection[]=[{title:'Simulação',rows:[['Cenário',o.title],['Fato gerador',readableDate(o.on_date)],['Regime',o.regime],['Base ajustada de IBS e CBS',o.base_cents/100,'BRL'],['Total simulado',(o.cbs_cents+o.ibs_cents+o.is_cents)/100,'BRL'],['Identificação',o.id]]}];
  if(versioned){
    function tax(name:string,base:number,rate:string,result:number,ref?:string){sections.push({title:name,rows:[['Base de cálculo',base/100,'BRL'],['Alíquota',Number(rate.replace(',','.')),'%'],['Valor simulado',result/100,'BRL'],['Origem da alíquota',ref??'Informada manualmente.']]})}
    tax('CBS',o.base_cents,d.cbs,o.cbs_cents,d.refCbs);tax('IBS total',o.base_cents,d.ibs,o.ibs_cents,d.refIbs);
    if(d.isRate!==undefined)tax('IS · base própria',Number(d.isBaseCents),d.isRate,o.is_cents);
    else sections.push({title:'Imposto Seletivo',rows:[['Inclusão','Não incluído. Isso não demonstra ausência de incidência.']]});
    const assumptions:Row[]=[['Critério','Base × alíquota. Arredondamento a centavos pelo meio par por tributo; IBS pelo percentual total. Não inclui créditos, compensações ou outros tributos.']];
    for(const [key,label] of Object.entries({origem:'Origem',cenarioCodigo:'Código do cenário',classificacao:'Classificação',tratamento:'Tratamento',premissas:'Premissas confirmadas',divergencias:'Divergências informadas',catalogo:'Catálogo consultado',catalogoFonte:'Fonte do catálogo'}))if(d[key])assumptions.push([label,d[key]]);
    if(!d.cenarioCodigo)assumptions.push(['Enquadramento','Cenário personalizado; enquadramento fiscal não verificado.']);
    if(d.artigo)assumptions.push(['Dispositivo do cenário',`LC 214/2025, ${d.artigo}`]);
    if(o.regime==='Simples Nacional')assumptions.push(['Limite','Não é o DAS nem apuração mensal. LC 123/2006, art. 18.'],['LC 123/2006',lc123]);
    else assumptions.push(['Base informada','Base ajustada, não necessariamente o preço da nota (LC 214/2025, art. 12).']);
    if(o.on_date.startsWith('2026-'))assumptions.push(['Transição de 2026','As referências de teste não se aplicam ao Simples. Não se calcula a dispensa condicionada do art. 348.']);
    assumptions.push(['LC 214/2025',lc214]);sections.push({title:'Premissas e fontes',rows:assumptions});
  } else sections.push({title:'Valores e dados registrados',rows:[['CBS',o.cbs_cents/100,'BRL'],['IBS',o.ibs_cents/100,'BRL'],['IS',o.is_cents/100,'BRL'],...Object.entries(d)]});
  return {title:'Memória de cálculo',filename:`e-leao-simulacao-${o.on_date}-${o.id}`,summary:disclaimer,sections};
}
const labels:Record<string,string>={
  oper:'Operação',numero:'Número do item',nObj:'Item',estadoItem:'Situação',tribCalc:'Tributos',total:'Totais retornados',IBSCBSTot:'IBS e CBS',ISTot:'IS',
  gIBSCBS:'Cálculo',gIBSUF:'IBS estadual',gIBSMun:'IBS municipal',gCBS:'CBS',gIBS:'IBS',gRed:'Redução',vBC:'Base de cálculo',vBCIBSCBS:'Base de IBS e CBS',vIBS:'Valor do IBS',vIS:'Valor do IS',vCBS:'Valor da CBS',vIBSUF:'Valor do IBS estadual',vIBSMun:'Valor do IBS municipal',
  pIBSUF:'Alíquota estadual',pIBSMun:'Alíquota municipal',pCBS:'Alíquota da CBS',pAliqEfet:'Alíquota efetiva',pRedAliq:'Redução da alíquota',baseRG:'Base do regime regular',baseSN:'Base do Simples Nacional',
  vIBSSN:'IBS do Simples',vCBSSN:'CBS do Simples',vIBSSNtot:'Total de IBS do Simples',vCBSSNtot:'Total de CBS do Simples',totalIs:'Total do IS',totalTributos:'Total de tributos',
  cst:'CST',cClassTrib:'Classificação tributária',cAtivSN:'Atividade do Simples',tpDoc:'Modelo do documento',dhFatoGerador:'Data e hora do fato gerador',uf:'UF',municipio:'Município (IBGE)',ncm:'NCM',nbs:'NBS',baseCalculo:'Base de cálculo',impostoSeletivo:'Imposto Seletivo',tributacaoRegular:'Comparação regular',aliquotasNominais:'Alíquotas nominais',
  erros:'Ocorrências',avisos:'Avisos',title:'Motivo',detail:'Detalhe',code:'Código',pointer:'Campo indicado',mensagem:'Mensagem',memoriaCalculo:'Memória de cálculo',itens:'Itens',id:'Identificação',versao:'Versão',anoFatoGerador:'Ano do fato gerador',opSimpNac:'Opção pelo Simples',vServ:'Valor do serviço',vDescIncond:'Desconto incondicional',vISSQN:'ISSQN',pIBSSN:'Alíquota efetiva do IBS',pCBSSN:'Alíquota efetiva da CBS'};
const monetary=new Set(('baseRG baseSN baseCalculo impostoInformado valorImpostoSeletivo totalIs totalTributos vProd vFrete vSeg vOutro vII vIS vDesc vPIS vCOFINS vICMS vICMSUFDest vFCP vFCPUFDest vICMSMono vISSQN vServ vDescIncond vTotOper vDescIncondTot somaAjustesLocImoveis vAjusteAplic vBC vBCIBSCBS vIBS vCBS vIBSUF vIBSMun vRBSNitem vRBSNtot vIBSSN vCBSSN vIBSSNtot vCBSSNtot vIBSPendSusp vCBSPendSusp vIBSSNtotPendSusp vCBSSNtotPendSusp').split(' '));
const percentages=new Set('pIBSSN pCBSSN pCBS pIBSUF pIBSMun pAliqEfet pRedAliq pCopropriedade cbs ibsEstadual ibsMunicipal adValorem'.split(' '));
const identifiers=new Set('municipio tpDoc anoFatoGerador opSimpNac regApIBSCBSSN tpEnteGov tpOperGov CRT numero nObj'.split(' '));
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
// Preserve nesting, nulls, errors, and leading zeros in classifications; never
// recompute totals or turn an absent motor value into zero.
function flatten(value:unknown,path:string[]=[],key=''):Row[]{
  if(Array.isArray(value)&&value.length)return value.flatMap((v,i)=>flatten(v,[...path,`${i+1}`],key));
  if(object(value)&&Object.keys(value).length)return Object.entries(value).flatMap(([k,v])=>flatten(v,[...path,Object.hasOwn(labels,k)?labels[k]:k],k));
  const name=path.join(' / ')||'Resultado';
  if(key==='estadoItem'&&typeof value==='string'){const states:Record<string,string>={CALCULADO:'Calculado',CALCULO_SIMULADO:'Cálculo simulado',NAO_CALCULADO:'Não calculado',INCONSISTENCIA_ENTRADA:'Confira os dados informados',NAO_IMPLEMENTADO:'Não implementado pelo motor',FALHA_TECNICA:'Falha no motor'};if(Object.hasOwn(states,value))return [[name,`${states[value]} (${value})`]]}
  if(identifiers.has(key)&&typeof value==='number')return [[name,String(value)]];
  const unit=monetary.has(key)?'BRL':percentages.has(key)?'%':undefined;
  if(unit&&(typeof value==='number'||typeof value==='string')&&/^-?\d+(?:\.\d+)?$/.test(String(value))&&String(value).replace(/[^0-9]/g,'').length<=15)return [[name,Number(value),unit]];
  return [[name,value==null?'Não informado':Array.isArray(value)||object(value)?'Nenhum registro':typeof value==='boolean'?(value?'Sim':'Não'):value as string|number]];
}
export function rtcReport(result:{body:Record<string,unknown>;status:number;warning:string|null},engine:Engine,date:string,scenario:string,payload:object,references:Row[]=[]):Report {
  const {body,status,warning}=result;
  const summary=[rtcStatus(body,engine),warning?'O motor sinalizou dados simulados.':'',disclaimer].filter(Boolean).join(' ');
  const sections:ReportSection[]=[{title:'Consulta',rows:[['Cenário',scenario],['Serviço',services[engine]],['Fato gerador',readableDate(date)],['Resposta do serviço',`HTTP ${status}`],...(warning?[[ 'Aviso de dados simulados',warning] as Row]:[])]}];
  if(engine==='base')sections.push({title:'Bases calculadas',rows:flatten(body)});
  else {
    if(Array.isArray(body.objetos))body.objetos.forEach((v,i)=>sections.push({title:`Item ${object(v)&&['string','number'].includes(typeof v.nObj)?v.nObj:i+1}`,rows:flatten(v)}));
    for(const [key,v] of Object.entries(body))if(key!=='objetos')sections.push({title:Object.hasOwn(labels,key)?labels[key]:key,rows:flatten(v)});
  }
  if(references.length)sections.push({title:'Referências do cenário',rows:references});
  sections.push({title:'Dados enviados',rows:flatten(payload)});
  return {title:'Relatório da consulta RTC',filename:`e-leao-rtc-${engine}-${date}`,summary,sections};
}
