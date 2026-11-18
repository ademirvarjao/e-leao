import {useState,type FormEvent} from 'react';import {Calculator as Calc,ArrowRight,BookmarkCheck,ChevronRight,Code2,Download,Landmark,Layers3,RotateCcw,Save,SlidersHorizontal} from 'lucide-react';import {MoneyInput} from '../components/MoneyInput';import {Field,Notice,PageHeading,Tile} from '../components/ui';import {useSpace} from '../lib/workspace';import {download,estimate,money,today} from '../lib/fiscal';import {friendly,queryRTC} from '../lib/client';import type {Operation,Regime} from '../lib/types';import {rtcExamples,rtcStatus,type Engine} from '../lib/rtc';import {navigate} from '../components/nav';
import {RateField,type RateEntry} from '../components/RateField';
import {rateLaw,rateReference,referenceLabel} from '../lib/rateReferences';
function RTC(){const {session,auth}=useSpace();const [engine,setEngine]=useState<Engine>('regular'),[text,setText]=useState(JSON.stringify(rtcExamples.regular,null,2)),[result,setResult]=useState<Awaited<ReturnType<typeof queryRTC>>|null>(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false);async function run(e:FormEvent){e.preventDefault();setErr('');setResult(null);let payload;try{payload=JSON.parse(text)}catch{setErr('O JSON está inválido. Confira aspas, vírgulas e chaves.');return}if(!payload||typeof payload!=='object'||Array.isArray(payload)){setErr('Informe uma operação como objeto JSON.');return}if(!session){auth('login');return}setBusy(true);try{setResult(await queryRTC(engine,payload))}catch(e){setErr(friendly(e))}finally{setBusy(false)}}return <section className="panel form-panel"><div className="block-title"><Tile icon={Code2} color="blue"/><div><h2>Consultar o motor RTC</h2><p>Envie uma operação no contrato da Receita e examine a memória original.</p></div></div><Notice>Integração avançada. Requer conta e uma instância RTC configurada pelo administrador. Os exemplos são ilustrativos; não inclua dados pessoais.</Notice><form className="stack" onSubmit={run}><Field label="Serviço"><select value={engine} disabled={busy} onChange={e=>{const v=e.target.value as Engine;setEngine(v);setText(JSON.stringify(rtcExamples[v],null,2));setResult(null);setErr('')}}><option value="regular">Regime regular · IBS, CBS e IS</option><option value="simple">Simples Nacional · IBS e CBS</option><option value="base">Base unificada da NFS-e</option></select></Field><Field label="Operação (JSON)"><textarea className="code" disabled={busy} required maxLength={65000} rows={13} value={text} onChange={e=>{setText(e.target.value);setResult(null)}}/></Field>{err&&<Notice tone="error">{err}</Notice>}<button className="btn primary align-start" disabled={busy}>{busy?'Consultando…':session?'Consultar motor':'Entrar para consultar'}<ArrowRight size={16}/></button></form>{result&&<div className="stack result"><h3>Retorno do motor · HTTP {result.status}</h3><Notice>{rtcStatus(result.body,engine)}</Notice>{result.warning&&<p>O gateway sinalizou dados simulados{/^\d{1,3}$/.test(result.warning)?` (aviso ${result.warning})`:''}. Não use este retorno como apuração oficial.</p>}<pre>{JSON.stringify(result.body,null,2)}</pre><button className="btn align-start" onClick={()=>download(JSON.stringify(result,null,2),'retorno-rtc.json')}><Download size={16}/> Baixar memória</button></div>}</section>}
export default function Calculator() {
  const {save,notify} = useSpace();
  const [tab,setTab] = useState('quick'), [regime,setRegime] = useState<Regime>('Regime regular');
  const [base,setBase] = useState(''), [date,setDate] = useState(today), [title,setTitle] = useState('Simulação de serviços');
  const [cbs,setCbs] = useState<RateEntry>({value:''}), [ibs,setIbs] = useState<RateEntry>({value:''});
  const [useIS,setUseIS] = useState(false), [isRate,setIsRate] = useState(''), [isBase,setIsBase] = useState('');
  const [result,setResult] = useState<Operation|null>(null), [err,setErr] = useState('');
  const [busy,setBusy] = useState(false), [savedId,setSavedId] = useState('');
  const cbsRef = rateReference('CBS',regime,date), ibsRef = rateReference('IBS',regime,date);
  const simple = regime === 'Simples Nacional';
  const clear = () => {setResult(null); setErr('')};
  function changeDate(next: string) {
    setDate(next);
    // Drop an applied reference when its legal basis changes (even if the number is the same).
    if (cbs.reference && cbs.reference !== rateReference('CBS',regime,next)) setCbs({value:''});
    if (ibs.reference && ibs.reference !== rateReference('IBS',regime,next)) setIbs({value:''});
  }
  function calc(e: FormEvent) {
    e.preventDefault(); setErr('');
    try {
      if (!title.trim()) throw Error('Informe um nome para o cenário.');
      const values = estimate(base,cbs.value,ibs.value,useIS?isRate:'0',useIS?isBase:'0');
      setResult({id:crypto.randomUUID(),kind:'simulation',title:title.trim(),regime,on_date:date,...values,
        created_at:new Date().toISOString(),details:{origem:'Estimativa local; não é apuração oficial.',cbs:cbs.value,ibs:ibs.value,
          ...(cbs.reference ? {refCbs:referenceLabel(cbs.reference)} : {}), ...(ibs.reference ? {refIbs:referenceLabel(ibs.reference)} : {}),
          ...(useIS ? {isRate,isBase} : {})}});
    } catch (e) {setErr(friendly(e)); setResult(null)}
  }
  async function store() {
    if (!result || busy) return;
    setBusy(true);
    try {await save(result); setSavedId(result.id); notify('Simulação salva no histórico.')} catch (e) {setErr(friendly(e))} finally {setBusy(false)}
  }
  return <><PageHeading kicker="FERRAMENTAS FISCAIS" title="Calculadora RTC" desc="Explore cenários de IBS, CBS e Imposto Seletivo."/>
    <Notice>Confira a <a href="https://consumo.tributos.gov.br/servico/calcular-tributos-consumo/calculadora/regime-geral" target="_blank" rel="noreferrer">calculadora oficial online</a> e suas regras vigentes. As referências não são atualizadas em tempo real. Esta estimativa não determina tributos devidos.</Notice>
    <div className="tabs"><button className={tab==='quick'?'active':''} onClick={()=>setTab('quick')}><SlidersHorizontal size={16}/> Estimativa rápida</button><button className={tab==='engine'?'active':''} onClick={()=>setTab('engine')}><Landmark size={16}/> Motor da Receita</button></div>
    {tab==='engine'?<RTC/>:<div className="form-layout"><form className="panel form-panel" onSubmit={calc} onChange={clear}>
      <div className="block-title"><Tile icon={Calc}/><div><h2>Nova simulação</h2><p>Defina os parâmetros da sua operação.</p></div></div>
      <div className="form-grid"><Field label="Nome do cenário" wide><input required maxLength={140} value={title} onChange={e=>setTitle(e.target.value)}/></Field>
        <Field label="Regime tributário"><select value={regime} onChange={e=>{setRegime(e.target.value as Regime);setUseIS(false);setCbs({value:''});setIbs({value:''})}}><option>Regime regular</option><option>Simples Nacional</option></select></Field>
        <Field label="Fato gerador"><input type="date" required value={date} onChange={e=>changeDate(e.target.value)}/></Field>
        <Field label="Base tributável ajustada (R$)" hint="Informe a base após os ajustes. Digite 1250,50 para ver 1.250,50." wide><MoneyInput value={base} onValueChange={setBase}/></Field>
        <RateField tax="CBS" label={`Alíquota ${simple?'efetiva ':''}CBS (%)`} entry={cbs} reference={cbsRef} onChange={entry=>{setCbs(entry);clear()}}/>
        <RateField tax="IBS" label={`Alíquota ${simple?'efetiva ':'total '}IBS (%)`} entry={ibs} reference={ibsRef} onChange={entry=>{setIbs(entry);clear()}}/>
        <div className="span-all"><Notice>{simple ? <>Não há percentual único do Simples Nacional. Informe os percentuais efetivos do seu enquadramento para a competência; as alíquotas de teste de 2026 não se aplicam aos optantes (art. 348, III, c). Esta estimativa não apura o DAS. <a href={rateLaw} target="_blank" rel="noreferrer">Consultar a lei</a>.</> : ibsRef ? <>
          <strong>Referência nominal · {cbsRef?'2026':'2027–2028'}.</strong> Use somente para simular a regra geral sem redução. {cbsRef?'Confira exceções, regimes específicos e condições de dispensa de recolhimento no art. 348.':'Sem sugestão de CBS para este período; informe o percentual aplicável.'} <a href={rateLaw} target="_blank" rel="noreferrer">LC 214/2025</a>. Revisão: 18/11/2026.
        </> : 'Sem referência cadastrada para esta data. Consulte a legislação aplicável antes de informar os percentuais.'}</Notice></div>
        {!simple&&<label className="check span-all"><input type="checkbox" checked={useIS} onChange={e=>setUseIS(e.target.checked)}/> Incluir Imposto Seletivo ad valorem</label>}
        {useIS&&<><Field label="Base própria do IS (R$)"><MoneyInput value={isBase} onValueChange={setIsBase}/></Field><Field label="Alíquota do IS (%)"><input required inputMode="decimal" value={isRate} onChange={e=>setIsRate(e.target.value)}/></Field><small className="span-all fineprint">Não há alíquota geral sugerida para o IS. Confirme a incidência, a vigência e a alíquota do bem ou serviço.</small></>}
      </div>{err&&<Notice tone="error">{err}</Notice>}
      <div className="actions calc-actions"><button className="btn primary"><Calc size={16}/> Calcular estimativa</button></div>
    </form><aside className="panel form-panel calc-result"><div className="block-title"><Tile icon={Layers3} color="blue"/><div><h2>Resumo do cálculo</h2><p>Memória do cenário</p></div></div>
      {result?<div aria-live="polite"><span className="minor-label">TOTAL ESTIMADO</span><p className="big-figure">{money(result.cbs_cents+result.ibs_cents+result.is_cents)}</p><dl className="summary-list">{[['Base',result.base_cents],['CBS',result.cbs_cents],['IBS',result.ibs_cents],['IS',result.is_cents]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{money(Number(v))}</dd></div>)}</dl>
        <p className="fineprint">Base × percentual ÷ 100 por tributo. Arredondamento para centavos (meio par).</p><button className="btn goldbtn full" disabled={busy||savedId===result.id} onClick={store}>{savedId===result.id?<BookmarkCheck size={16}/>:<Save size={16}/>}{savedId===result.id?'Simulação salva':busy?'Salvando…':'Salvar simulação'}</button>{savedId===result.id&&<button className="textbtn next-link" onClick={()=>navigate('historico')}>Abrir histórico <ChevronRight size={15}/></button>}
      </div>:<div className="waiting"><RotateCcw size={26}/><h3>Aguardando os parâmetros</h3><p>Preencha os campos e calcule para ver a distribuição dos tributos.</p></div>}
    </aside></div>}</>;
}
