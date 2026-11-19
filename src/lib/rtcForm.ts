// Build the three RTC contracts from labeled fields. Only fields in the active
// branch of the form may reach the gateway; no sample rates or places are used.
import places from '../data/rtc-municipios.json';
import {decimal,validDate} from './fiscal';
import {documentLabels,isInCatalogPeriod,scenarios,type Scenario} from './scenarios';
import type {Engine} from './rtc';

export type Values = Record<string,string>;
export type RtcDraft = {header:Values; items:Values[]; adjustments:Values[]};
type Options = Record<string,string>;
export type Spec = {key:string; label:string; kind:'choice'|'money'|'rate'|'decimal'|'text'|'time'; required?:boolean; options?:Options; numeric?:boolean; digits?:number; locked?:boolean; hint?:string};
export type Group = {title:string; fields:Spec[]};
export class FormProblem extends Error {}
const choice = (key:string,label:string,options:Options,required=true):Spec => ({key,label,kind:'choice',options,required});
const amount = (key:string,label:string,required=false):Spec => ({key,label:label+' (R$)',kind:'money',required});
const rate = (key:string,label:string,required=false):Spec => ({key,label:label+' (%)',kind:'rate',required});
const text = (key:string,label:string,required=false):Spec => ({key,label,kind:'text',required});
const qty = (key:string,label:string,required=false):Spec => ({key,label,kind:'decimal',required});
const numberChoice = (f:Spec):Spec => ({...f,numeric:true});
const localities: Record<string,Options> = places;
const yesNo = {no:'Não',yes:'Sim'};
const levels = {'1':'União','2':'Estado','3':'Distrito Federal','4':'Município'};
const timeZones = Object.fromEntries(['-05:00','-04:00','-03:00','-02:00','+00:00'].map(v=>[v,'UTC'+v]));
const nomenclature = {ncm:'Mercadoria · NCM',nbs:'Serviço · NBS',none:'Sem nomenclatura aplicável'};
const components:Options = {vProd:'Produtos ou serviços',vFrete:'Frete',vSeg:'Seguro',vOutro:'Outras despesas',vII:'Imposto de importação',vIS:'Imposto Seletivo',vDesc:'Desconto incondicional',vPIS:'PIS',vCOFINS:'Cofins',vICMS:'ICMS',vICMSUFDest:'ICMS da UF de destino',vFCP:'Fundo de combate à pobreza (FCP)',vFCPUFDest:'FCP da UF de destino',vICMSMono:'ICMS monofásico',vISSQN:'ISSQN'};
const official = scenarios.filter(s=>!s.id.startsWith('comum:'));
const lookup = (family:Scenario['family'],code:string)=>official.find(s=>s.family===family && s.code===code);
const optionsFor = (family:Scenario['family'],date:string) => Object.fromEntries(official.filter(s=>s.family===family && isInCatalogPeriod(s,date)).map(s=>[s.code,`${s.code} · ${s.label}`]));
function suggestedNomen(s?:Scenario) {return s?.nomenclature==='NCM'?'ncm':s?.nomenclature==='NBS'?'nbs':s?.nomenclature==='Não possui'?'none':''}
export function newItem(s?:Scenario):Values {
  return {_id:crypto.randomUUID(),_base:'amount',_nominals:'no',_useIs:s?.family==='is'?'yes':'no',_nomen:suggestedNomen(s),
    ...(s?.family==='sn'?{cAtivSN:s.code}:s?.family==='is'?{'impostoSeletivo.cClassTrib':s.code}:s?{cClassTrib:s.code}:{})};
}
export function newDraft(s?:Scenario):RtcDraft {
  return {header:{tpDoc:s?.documents.length===1?String(s.documents[0]):''},items:[newItem(s)],adjustments:[]};
}
export function changeItem(item:Values,key:string,value:string):Values {
  const next={...item,[key]:value};
  const drop=(prefix:string)=>{for(const field of Object.keys(next))if(field.startsWith(prefix))delete next[field]};
  // Reconfirm dependent rates, not the unrelated amounts, units and place the
  // person already filled in. In particular, selecting IS must not reset IBS/CBS.
  if(key==='cClassTrib'){
    next._nomen=suggestedNomen(lookup('ibsCbs',value))||item._nomen;
    next._nominals='no';drop('tributacaoRegular.');for(const k of ['aliquotasNominais.cbs','aliquotasNominais.ibsEstadual','aliquotasNominais.ibsMunicipal'])delete next[k];
  }
  if(key==='cAtivSN'||key==='cClassTrib'){delete next.pIBSSN;delete next.pCBSSN}
  if(key==='impostoSeletivo.cClassTrib'||key==='_useIs'&&value==='no'){drop('aliquotasNominais.impostoSeletivo.');delete next['impostoSeletivo.impostoInformado']}
  if(key==='_useIs'&&value==='no')drop('impostoSeletivo.');
  return next;
}
export function headerGroups(engine:Engine,v:Values,scenario?:Scenario):Group[] {
  if(engine==='base') {
    const renting=v.situacao==='locacao9903';
    return [{title:'Enquadramento do serviço',fields:[numberChoice(choice('opSimpNac','Opção pelo Simples Nacional',{'1':'Não optante','2':'MEI','3':'Optante ME / EPP','4':'Optante pendente'})),
      ...(['3','4'].includes(v.opSimpNac)?[numberChoice(choice('regApIBSCBSSN','Forma de apuração',{'1':'IBS e CBS pelo Simples','2':'CBS pelo Simples e IBS regular','3':'IBS e CBS regulares'}))]:[]),
      choice('situacao','Situação do serviço',{comum:'Serviço comum',salaoParceiro:'Salão parceiro',...(!['2','3'].includes(v.opSimpNac)?{locacao9903:'Locação de imóveis (99.03)'}:{})})]},
      {title:renting?'Valores da locação':'Valores do serviço',fields:[...(renting?[rate('locacao.pCopropriedade','Parcela de copropriedade',true),amount('locacao.vTotOper','Valor total da locação',true),amount('locacao.vDescIncondTot','Desconto total',true),amount('locacao.somaAjustesLocImoveis','Soma dos ajustes da locação',true)]:[amount('vServ','Valor do serviço',true),amount('vDescIncond','Desconto incondicional')]),amount('vISSQN','ISSQN destacado'),amount('vPIS','PIS'),amount('vCOFINS','Cofins')]}];
  }
  const docs=scenario?.documents.length?scenario.documents.map(String):Object.keys(documentLabels);
  const doc=choice('tpDoc','Modelo do documento',Object.fromEntries(docs.map(k=>[k,`${documentLabels[k]} (${k})`])),engine==='simple');
  if(engine==='simple')return [{title:'Dados da operação',fields:[doc,choice('CRT','Regime do emitente',{'1':'Simples Nacional','2':'Simples Nacional · excesso de sublimite','3':'Regime normal com apuração por fora'}),
    ...(v.CRT==='3'?[choice('tpRegimeIBSCBS','Apuração de IBS e CBS',{'2':'Apuração por fora do Simples'})]:[]),choice('tpEnteGov','Ente público adquirente',levels,false)]}];
  return [{title:'Local e momento da operação',fields:[choice('uf','UF do fato gerador',Object.fromEntries(Object.keys(localities).map(k=>[k,k==='EX'?'Exterior':k]))),
    numberChoice(choice('municipio','Município do fato gerador',localities[v.uf]??{})),{key:'_hour',label:'Hora do fato gerador',kind:'time',required:true},choice('_zone','Fuso horário da operação',timeZones),numberChoice(doc),
    numberChoice(choice('gCompraGov.tpEnteGov','Ente público adquirente',{...levels,'5':'Consórcio público','6':'Comitê Gestor do IBS'},false)),
    ...(v['gCompraGov.tpEnteGov']?[numberChoice(choice('gCompraGov.tpOperGov','Operação com o ente público',{'1':'Fornecimento com pagamento posterior','2':'Pagamento de fornecimento já realizado','3':'Fornecimento já pago','4':'Pagamento com fornecimento posterior','5':'Fornecimento e pagamento simultâneos'},false))]:[])]}];
}
export function itemGroups(engine:Engine,v:Values,date:string,h:Values,selected?:Scenario):Group[] {
  const ibs=lookup('ibsCbs',v.cClassTrib), classes=optionsFor('ibsCbs',date);
  const cls={...choice('cClassTrib','Classificação de IBS e CBS',classes),locked:selected?.family==='ibsCbs'};
  if(engine==='simple')return [{title:'Atividade e valores',fields:[{...choice('cAtivSN','Atividade do Simples',optionsFor('sn',date)),locked:selected?.family==='sn'},cls,amount('baseCalculo','Base do item sem IS',true),
    {...amount('valorImpostoSeletivo','IS já calculado',true),hint:'Informe zero se não houver IS.'},...(h.CRT!=='2'?[rate('pIBSSN','IBS efetivo, se exigido')]:[]),rate('pCBSSN','CBS efetiva, se exigida')]}];
  const isOptions=optionsFor('is',date), hasIsOptions=Object.keys(isOptions).length>0;
  const withIS=v._useIs==='yes', comparison=ibs?.requiresRegular, fuel=ibs?.cst==='620';
  const kind=v._nomen, groups:Group[]=[{title:'Identificação do item',fields:[cls,choice('_nomen','Identificação do bem ou serviço',nomenclature),
    ...(kind==='ncm'||kind==='nbs'?[{...text(kind,kind==='ncm'?'NCM da mercadoria (8 dígitos)':'NBS do serviço (9 dígitos)',true),digits:kind==='ncm'?8:9,hint:'Copie o código fiscal do item, sem pontos ou espaços.'}]:[]),
    ...(comparison?[choice('tributacaoRegular.cClassTrib','Classificação regular de comparação',classes)]:[]),
    qty('quantidade','Quantidade do item',fuel),text('unidade','Unidade de medida do item',fuel)]},
    {title:'Base de cálculo',fields:[choice('_base','Como informar a base',{amount:'Informar a base ajustada',components:'Compor a base por parcelas'}),
      ...(v._base==='components'?Object.entries(components).map(([k,label])=>amount('gComponentesBC.'+k,label,k==='vProd')):[{...amount('baseCalculo','Base ajustada de IBS e CBS',!withIS),hint:withIS?'Deixe em branco para o motor derivar a base a partir do IS.':undefined}]),
      {...choice('_useIs','Incluir Imposto Seletivo',hasIsOptions?yesNo:{no:'Sem classificação de IS no catálogo nesta data'}),locked:!hasIsOptions||selected?.family==='is'}]}];
  if(withIS)groups.push({title:'Imposto Seletivo',fields:[{...choice('impostoSeletivo.cClassTrib','Classificação do IS',isOptions),locked:selected?.family==='is'},amount('impostoSeletivo.baseCalculo','Base própria do IS',true),amount('impostoSeletivo.impostoInformado','IS informado'),qty('impostoSeletivo.quantidade','Quantidade para o IS'),text('impostoSeletivo.unidade','Unidade de medida para o IS')]});
  // RTC 1.6.1, ProcessamentoItemService.validarAliquotasNominais: after 2026
  // the trio is mandatory only for CSTs with SITR_IND_GIBSCBS, not every item.
  if(date>='2027-01-01' && ibs){
    const required=!!ibs.nominalGroup;
    groups.push({title:'Alíquotas nominais para simulação',fields:[
      ...(!required?[choice('_nominals','Informar percentuais opcionais de IBS e CBS?',yesNo)]:[]),
      ...(required||v._nominals==='yes'?[rate('aliquotasNominais.cbs','CBS nominal',required),rate('aliquotasNominais.ibsEstadual','IBS estadual nominal',required),rate('aliquotasNominais.ibsMunicipal','IBS municipal nominal',required)]:[]),
      ...(withIS?[rate('aliquotasNominais.impostoSeletivo.adValorem','IS sobre o valor'),qty('aliquotasNominais.impostoSeletivo.adRem','IS específico (R$ por unidade)')]:[])]});
  }
  return groups;
}
export const adjustmentFields=(v:Values):Spec[]=>[choice('tpAjusteBC','Tipo de ajuste',{'101':'Subcontratação','102':'Consórcio','103':'Intermediação','104':'Cessão de mão de obra','105':'Ressarcimento','199':'Outros','9':'Profissional parceiro'}),amount('vAjusteAplic','Valor do ajuste',true),...(v.tpAjusteBC==='199'?[text('xTpAjusteBC','Descrição do ajuste',true)]:[])];

type Obj = {[key:string]:string|number|Obj|Obj[]};
function serialize(fields:Spec[],values:Values,textDecimals=false):Obj {
  const out:Obj={};
  for(const f of fields) {
    const value=(values[f.key]??'').trim();
    if(!value){if(f.required)throw new FormProblem(`Preencha o campo “${f.label}”.`);continue}
    let parsed:string|number=value;
    if(f.kind==='choice'){
      if(!Object.hasOwn(f.options!,value))throw new FormProblem(`Selecione uma opção válida em “${f.label}”.`);
      if(f.numeric)parsed=Number(value);
    } else if(f.kind==='money'||f.kind==='rate'||f.kind==='decimal'){
      try {const d=decimal(value,f.kind==='money'?2:4,f.kind==='rate'?100:f.kind==='money'?9_999_999_999_999:99_999_999_999);
        parsed=textDecimals?d.toFixed(f.kind==='money'?2:undefined):d.toNumber();
      }catch{throw new FormProblem(`Confira “${f.label}”: use um valor não negativo${f.kind==='rate'?', até 100%':''}, com até ${f.kind==='money'?2:4} casas decimais.`)}
    } else if((f.digits&&!new RegExp(`^\\d{${f.digits}}$`).test(value))||(f.kind==='time'&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))||value.length>160)throw new FormProblem(`Confira o campo “${f.label}”.`);
    if(f.key.startsWith('_'))continue;
    // Paths come exclusively from the field definitions, never from user input.
    const path=f.key.split('.');let group=out;
    for(const key of path.slice(0,-1))group=(group[key]??={}) as Obj;
    group[path.at(-1)!]=parsed;
  }
  return out;
}
export function buildRtcRequest(engine:Engine,date:string,d:RtcDraft,selected?:Scenario):Obj {
  if(selected && engine!==(selected.family==='sn'?'simple':'regular'))throw new FormProblem('Escolha o serviço correspondente ao cenário.');
  if(!validDate(date)||selected&&!isInCatalogPeriod(selected,date))throw new FormProblem('Confira o fato gerador e a vigência do cenário.');
  const h=d.header, header=serialize(headerGroups(engine,h,selected).flatMap(g=>g.fields),h);
  let payload:Obj;
  if(engine==='base')payload={anoFatoGerador:Number(date.slice(0,4)),...header,...(h.situacao!=='locacao9903'&&d.adjustments.length?{documentos:d.adjustments.map(a=>serialize(adjustmentFields(a),a))}:{})};
  else {
    if(!d.items.length)throw new FormProblem('Adicione pelo menos um item à operação.');
    const itens=d.items.map((v,i)=>{
      const s=i===0?selected:undefined;
      const item=serialize(itemGroups(engine,v,date,h,s).flatMap(g=>g.fields),v,engine==='simple');
      const cls=lookup('ibsCbs',v.cClassTrib)!;
      const classification=engine==='simple'?lookup('sn',v.cAtivSN)!:cls;
      if(h.tpDoc && classification.documents.length && !classification.documents.includes(Number(h.tpDoc)))throw new FormProblem(`Item ${i+1}: o documento escolhido não está vinculado a esta classificação ou atividade.`);
      if(s && (s.family==='sn'?v.cAtivSN:s.family==='is'?v._useIs==='yes'&&v['impostoSeletivo.cClassTrib']:v.cClassTrib)!==s.code)throw new FormProblem('O primeiro item deve corresponder ao cenário selecionado.');
      if(engine==='regular'){
        item.cst=cls.cst!;
        if(item.tributacaoRegular)(item.tributacaoRegular as Obj).cst=lookup('ibsCbs',v['tributacaoRegular.cClassTrib'])!.cst!;
        if(item.impostoSeletivo)(item.impostoSeletivo as Obj).cst=lookup('is',v['impostoSeletivo.cClassTrib'])!.cst!;
      }
      return {numero:i+1,...item};
    });
    payload={id:crypto.randomUUID(),...(engine==='regular'?{versao:'1.0.0',dhFatoGerador:`${date}T${h._hour}:00${h._zone}`}:{versao:'2.0.0',data:date}),...header,itens};
  }
  if(JSON.stringify(payload).length>65000)throw new FormProblem('Há dados demais para uma consulta. Divida os itens em operações menores.');
  return payload;
}
