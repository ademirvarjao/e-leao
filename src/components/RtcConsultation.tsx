import {useState,type FormEvent} from 'react';
import {ArrowRight,Landmark,Plus,Trash2} from 'lucide-react';
import {friendly,queryRTC} from '../lib/client';
import {services,type Engine} from '../lib/rtc';
import {adjustmentFields,buildRtcRequest,changeItem,FormProblem,headerGroups,itemGroups,newDraft,newItem,type Group,type Spec,type Values} from '../lib/rtcForm';
import {rtcReport,type Report} from '../lib/reports';
import {catalogLabel,catalogSource,isInCatalogPeriod,scenarioCode,scenarios,type Scenario} from '../lib/scenarios';
import {lc123,lc214} from '../lib/legal';
import {useSpace} from '../lib/workspace';
import {ReportExports,ReportSectionView} from './ReportExports';
import {MoneyInput} from './MoneyInput';
import {Field,Notice,Tile} from './ui';

type FieldsProps={values:Values;change:(key:string,value:string)=>void};
function Input({f,values,change}:FieldsProps&{f:Spec}) {
  const value=values[f.key]??'',update=(v:string)=>{if(v!==value)change(f.key,v)};
  return <Field label={f.label} hint={f.hint} wide={f.key.includes('cClassTrib')||f.key==='cAtivSN'}>
    {f.kind==='choice'?<select value={value} required={f.required} disabled={f.locked} onChange={e=>update(e.target.value)}>
      <option value="">{f.required?'Selecione…':'Não informar'}</option>{Object.entries(f.options!).map(([code,label])=><option key={code} value={code}>{label}</option>)}
    </select>:f.kind==='money'?<MoneyInput required={!!f.required} value={value} onValueChange={update}/>:<input type={f.kind==='time'?'time':'text'} inputMode={f.digits?'numeric':f.kind==='rate'||f.kind==='decimal'?'decimal':undefined} pattern={f.digits?`[0-9]{${f.digits}}`:undefined} maxLength={f.digits??160} value={value} required={f.required} onChange={e=>update(e.target.value)}/>}
  </Field>;
}
function FieldGroup({group,...props}:FieldsProps&{group:Group}) {
  return <fieldset className="rtc-fields"><legend>{group.title}</legend><div className="form-grid">{group.fields.map(f=><Input key={f.key} f={f} {...props}/>)}</div></fieldset>;
}

export default function RtcConsultation({scenario,date,baseOnly=false}:{scenario?:Scenario;date:string;baseOnly?:boolean}) {
  const {session,auth}=useSpace();
  const [engine,setEngine]=useState<Engine>(baseOnly?'base':scenario?.family==='sn'?'simple':'regular');
  const [draft,setDraft]=useState(()=>newDraft(scenario));
  const [result,setResult]=useState<{report:Report;original:Awaited<ReturnType<typeof queryRTC>>}|null>(null);
  const [err,setErr]=useState(''),[busy,setBusy]=useState(false);
  const available=engine==='base'||scenarios.some(s=>s.family===(engine==='simple'?'sn':'ibsCbs')&&isInCatalogPeriod(s,date));
  const clear=()=>{setResult(null);setErr('')};
  const changeHeader=(key:string,value:string)=>{clear();setDraft(d=>({...d,header:{...d.header,[key]:value,...(key==='uf'?{municipio:''}:{}),...(key==='opSimpNac'?{regApIBSCBSSN:'',situacao:''}:{})}}))};
  function changeRow(list:'items'|'adjustments',i:number,key:string,value:string) {
    clear();setDraft(d=>({...d,[list]:d[list].map((v,j)=>j!==i?v:list==='items'?changeItem(v,key,value):{...v,[key]:value})}));
  }
  function remove(list:'items'|'adjustments',i:number){clear();setDraft(d=>({...d,[list]:d[list].filter((_,j)=>j!==i)}))}
  async function run(e:FormEvent){
    e.preventDefault();if(busy)return;clear();
    try {
      const payload=buildRtcRequest(engine,date,draft,scenario);
      if(!session){auth('login');return}
      setBusy(true);const original=await queryRTC(engine,payload);
      setResult({original,report:rtcReport(original,engine,date,scenario?.label??services[engine],payload,scenario?[['Classificação selecionada',scenarioCode(scenario)],['Condições a conferir',scenario.guidance],['Dispositivo legal',`${scenario.family==='sn'?'LC 123/2006':'LC 214/2025'}, ${scenario.article}`],['Texto legal',scenario.family==='sn'?lc123:lc214],['Catálogo',catalogLabel],['Fonte da classificação',catalogSource]]:[])});
    }catch(e){setErr(e instanceof FormProblem?e.message:friendly(e))}finally{setBusy(false)}
  }
  return <section className="panel form-panel rtc-consultation"><div className="block-title"><Tile icon={Landmark} color="blue"/><div><h2>{baseOnly?'Compor a base da NFS-e':'Consultar o motor RTC'}</h2><p>{baseOnly?'Preencha os valores do serviço. Esta consulta não emite uma nota.':'Informe os dados reais do documento. O cenário já identifica o primeiro item.'}</p></div></div>
    <form onSubmit={run}><fieldset className="rtc-body" aria-label="Dados para consulta" disabled={busy}>
      {!baseOnly&&!scenario&&<Field label="Serviço de cálculo"><select value={engine} onChange={e=>{clear();setEngine(e.target.value as Engine);setDraft(newDraft())}}><option value="regular">{services.regular}</option><option value="simple">{services.simple}</option></select></Field>}
      {!available?<Notice>Nenhum cenário deste serviço está vigente no catálogo para a data selecionada. Confira o fato gerador acima ou escolha outro serviço.</Notice>:<>
      <p className="fineprint">Os campos com asterisco (*) são obrigatórios. Preencha os demais apenas quando se aplicarem à operação.</p>
      {headerGroups(engine,draft.header,scenario).map(group=><FieldGroup key={group.title} group={group} values={draft.header} change={changeHeader}/>)}
      {engine!=='base'?<>{draft.items.map((item,i)=><section className="rtc-item" key={item._id} aria-label={`Item ${i+1}`}><div className="rtc-item-head"><h3>Item {i+1}</h3>{i>0&&<button type="button" className="textbtn" onClick={()=>remove('items',i)}><Trash2 size={15}/> Remover item {i+1}</button>}</div>
        {itemGroups(engine,item,date,draft.header,i===0?scenario:undefined).map(group=><FieldGroup key={group.title} group={group} values={item} change={(k,v)=>changeRow('items',i,k,v)}/>)}</section>)}
        <button className="btn align-start" type="button" onClick={()=>{clear();setDraft(d=>({...d,items:[...d.items,newItem()]}))}}><Plus size={16}/> Adicionar item</button></>:
        draft.header.situacao!=='locacao9903'&&<>{draft.adjustments.map((row,i)=><div className="rtc-item" key={row._id}><FieldGroup group={{title:`Ajuste ${i+1}`,fields:adjustmentFields(row)}} values={row} change={(k,v)=>changeRow('adjustments',i,k,v)}/><button className="textbtn" type="button" onClick={()=>remove('adjustments',i)}>Remover ajuste {i+1}</button></div>)}<button className="btn align-start" type="button" onClick={()=>{clear();setDraft(d=>({...d,adjustments:[...d.adjustments,{_id:crypto.randomUUID()}]}))}}><Plus size={16}/> Adicionar documento de ajuste</button></>}
      <p className="fineprint">Os dados só são enviados ao consultar. Não inclua dados pessoais. A cobertura depende do motor configurado para a conta.</p>
      {err&&<Notice tone="error">{err}</Notice>}<button className="btn primary align-start" disabled={busy}>{busy?'Consultando…':session?'Consultar motor':'Entrar para consultar'}<ArrowRight size={16}/></button></>}
    </fieldset></form>
    {result&&<section className="rtc-result stack" aria-label="Resultado da consulta"><h2>Resultado da consulta</h2><Notice>{result.report.summary}</Notice>
      <ReportExports report={result.report} original={result.original}/>
      {result.report.sections.map((s,i)=><details className="inset" key={i} open={i===0||s.title.startsWith('Item ')||s.title==='Bases calculadas'}><summary>{s.title}</summary><ReportSectionView section={s}/></details>)}
    </section>}
  </section>;
}
