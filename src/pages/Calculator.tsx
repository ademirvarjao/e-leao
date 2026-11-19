import {useState, type FormEvent} from 'react';
import {ArrowRight, BookmarkCheck, Calculator as Calc, ChevronRight, Download, Landmark, Layers3, RotateCcw, Save, SlidersHorizontal} from 'lucide-react';
import {LawLink} from '../components/LawLink';
import {MoneyInput} from '../components/MoneyInput';
import {RateField} from '../components/RateField';
import {RtcConsultation} from '../components/RtcConsultation';
import {ScenarioPicker} from '../components/ScenarioPicker';
import {SimulationMemory} from '../components/SimulationMemory';
import {navigate} from '../components/nav';
import {Field, Notice, PageHeading, Tile} from '../components/ui';
import {friendly} from '../lib/client';
import {download, readableDate, today, validDate} from '../lib/fiscal';
import {svrs} from '../lib/legal';
import {rateReference, type RateEntry} from '../lib/rateReferences';
import {documentOptions, isInCatalogPeriod, scenarioCode, suggestedRate, treatment, type Scenario} from '../lib/scenarios';
import {quickScope, simulate} from '../lib/simulation';
import type {Operation, Regime} from '../lib/types';
import {useSpace} from '../lib/workspace';

export default function Calculator() {
  const {save,notify} = useSpace();
  const [tab,setTab] = useState<'quick'|'engine'>('quick'), [regime,setRegime] = useState<Regime>('Regime regular');
  const [scenario,setScenario] = useState<Scenario>(), [confirmed,setConfirmed] = useState(false);
  const [base,setBase] = useState(''), [date,setDate] = useState(today), [title,setTitle] = useState('Simulação personalizada');
  const [cbs,setCbs] = useState<RateEntry>({value:''}), [ibs,setIbs] = useState<RateEntry>({value:''});
  const [useIS,setUseIS] = useState(false), [isRate,setIsRate] = useState(''), [isBase,setIsBase] = useState('');
  const [result,setResult] = useState<Operation|null>(null), [err,setErr] = useState('');
  const [busy,setBusy] = useState(false), [savedId,setSavedId] = useState('');
  const simple = regime === 'Simples Nacional', quick = !scenario || !!scenario.quick;
  const inPeriod = scenario ? isInCatalogPeriod(scenario,date) : validDate(date);
  const canEstimate = quick && inPeriod && (!scenario || confirmed);
  const cbsRef = suggestedRate('CBS',regime,date,scenario,confirmed), ibsRef = suggestedRate('IBS',regime,date,scenario,confirmed);
  const clear = () => {setResult(null); setErr('')};
  function resetRates() {setCbs({value:''}); setIbs({value:''}); setUseIS(false); setIsBase(''); setIsRate(''); clear()}
  function pick(next?: Scenario) {
    setScenario(next); if (next) setRegime(next.regime);
    setConfirmed(false); resetRates();
  }
  function changeDate(next: string) {
    setDate(next); clear();
    if (scenario) {setConfirmed(false); resetRates(); return}
    if (cbs.reference && cbs.reference !== rateReference('CBS',regime,next)) setCbs({value:''});
    if (ibs.reference && ibs.reference !== rateReference('IBS',regime,next)) setIbs({value:''});
  }
  function calc(e: FormEvent) {
    e.preventDefault(); setErr('');
    try {setResult(simulate({scenario, title:scenario?.label ?? title, regime,date,base,cbs,ibs,confirmed, is:useIS?{base:isBase,rate:isRate}:undefined}))}
    catch (e) {setErr(friendly(e)); setResult(null)}
  }
  async function store() {
    if (!result || busy) return;
    setBusy(true);
    try {await save(result); setSavedId(result.id); notify('Simulação salva no histórico.')} catch (e) {setErr(friendly(e))} finally {setBusy(false)}
  }
  return <><PageHeading kicker="FERRAMENTAS FISCAIS" title="Calculadora RTC" desc="Escolha uma operação para comparar valores, conferir premissas e consultar as regras de IBS, CBS e IS."/>
    <Notice>Estimativa independente, não guia de recolhimento. As referências não são atualizadas em tempo real. Confira a <a href="https://consumo.tributos.gov.br/servico/calcular-tributos-consumo/calculadora/regime-geral" target="_blank" rel="noreferrer">calculadora oficial online</a> e a legislação da data da operação.</Notice>
    <div className="tabs"><button className={tab==='quick'?'active':''} onClick={()=>setTab('quick')}><SlidersHorizontal size={16}/> Estimativa rápida</button><button className={tab==='engine'?'active':''} onClick={()=>setTab('engine')}><Landmark size={16}/> Motor da Receita</button></div>
    {tab==='engine' ? scenario && !inPeriod ? <section className="panel form-panel"><Notice>A data escolhida está fora da vigência desta opção no catálogo. Revise o fato gerador ou escolha outro cenário.</Notice><button className="btn" onClick={()=>setTab('quick')}>Rever cenário e data</button></section> : <RtcConsultation scenario={scenario} date={date}/> :
    <div className="form-layout"><form className="panel form-panel" onSubmit={calc}>
      <div className="block-title"><Tile icon={Calc}/><div><h2>Nova simulação</h2><p>Comece pelo cenário. A data e o enquadramento determinam as sugestões disponíveis.</p></div></div>
      <div className="form-grid"><ScenarioPicker date={date} selected={scenario} onPick={pick}/>
        {!scenario && <Field label="Título personalizado" wide><input required maxLength={140} value={title} onChange={e=>{setTitle(e.target.value);clear()}}/></Field>}
        <Field label="Regime tributário"><select disabled={!!scenario} value={regime} onChange={e=>{setRegime(e.target.value as Regime);resetRates()}}><option>Regime regular</option><option>Simples Nacional</option></select></Field>
        <Field label="Fato gerador"><input type="date" required value={date} onChange={e=>changeDate(e.target.value)}/></Field>
        {scenario && <section className="scenario-guide span-all" aria-label="Configuração sugerida"><span className="eyebrow">CONFIGURAÇÃO SUGERIDA</span>
          <h3>{scenario.label}</h3><p className="scenario-code">{scenarioCode(scenario)}</p>
          <p><b>{scenario.quick ? treatment(scenario.quick) : 'Consulta por item no motor RTC'}.</b> {scenario.guidance}</p>
          {!scenario.quick && scenario.rtcTreatment && <p>Tratamento descrito no RTC: <b>{scenario.rtcTreatment}</b>. Não equivale a uma alíquota informada ou a um resultado calculado.</p>}
          <p><LawLink article={scenario.article} simple={simple}/>{scenario.family==='ibsCbs' && <> · <a href={svrs} target="_blank" rel="noreferrer">Tabela CST/cClassTrib · SVRS</a></>}</p>
          {scenario.documents.length>0 && <details className="scenario-docs"><summary>Documentos vinculados no catálogo ({scenario.documents.length})</summary><p>{documentOptions(scenario)}. Confirme o modelo da sua operação.</p></details>}
          <small className="fineprint">Vigência no catálogo: desde {readableDate(scenario.from)}{scenario.until?` até ${readableDate(scenario.until)}`:' (sem data final cadastrada)'}. O código não comprova o enquadramento legal.</small>
          {!inPeriod ? <Notice tone="error">{date ? 'Fato gerador fora da vigência desta opção no catálogo.' : 'Informe o fato gerador.'} Escolha a data da operação ou outro cenário.</Notice> : scenario.quick ? <>
            <p>{quickScope}</p><label className="check"><input type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);resetRates()}}/> Conferi as condições deste cenário para a data informada.</label>
            {confirmed && (cbsRef || ibsRef) && <button type="button" className="btn align-start" disabled={(!cbsRef||!!cbs.reference)&&(!ibsRef||!!ibs.reference)} onClick={()=>{
              if(cbsRef) setCbs({value:cbsRef.percent,reference:cbsRef}); if(ibsRef) setIbs({value:ibsRef.percent,reference:ibsRef}); clear();
            }}>Aplicar sugestões: {[cbsRef,ibsRef].filter(r=>!!r).map(r=>`${r.tax} ${r.percent}%`).join(' · ')}</button>}
          </> : <button type="button" className="btn primary align-start" onClick={()=>setTab('engine')}>Preparar consulta ao motor <ArrowRight size={15}/></button>}
        </section>}
        {quick && <div className="span-all fineprint">{scenario?'O regime acompanha o cenário. Para editar livremente, escolha Cenário personalizado.':'Confirme a opção de apuração do IBS e da CBS antes de informar percentuais.'} <LawLink article="art. 41"/>.</div>}
        {canEstimate && <>
          <div className="span-all"><Field label="Base tributável ajustada (R$)" hint="Digite 1250,50 para ver 1.250,50."><MoneyInput value={base} onValueChange={v=>{if(v!==base){setBase(v);clear()}}}/></Field>
            <p className="fineprint field-source">{simple ? <>Use a base compatível com os percentuais efetivos informados. <LawLink simple article="art. 18"/>.</> : <>Informe o valor após as inclusões e exclusões aplicáveis, não o valor bruto por padrão. <LawLink article="art. 12"/>.</>}</p></div>
          <RateField tax="CBS" label={`Alíquota ${simple?'efetiva ':''}CBS (%)`} entry={cbs} reference={cbsRef} onChange={entry=>{setCbs(entry);clear()}}/>
          <RateField tax="IBS" label={`Alíquota ${simple?'efetiva ':'total '}IBS (%)`} entry={ibs} reference={ibsRef} onChange={entry=>{setIbs(entry);clear()}}/>
          <div className="span-all"><Notice>{simple ? <>Não há percentual único do Simples Nacional. Informe as parcelas efetivas aplicáveis; o cálculo mensal depende da receita, do anexo e da faixa. Não apuramos o DAS (<LawLink simple article="art. 18"/>). As referências de teste de 2026 não se aplicam aos optantes (<LawLink article="art. 348, III, c"/>).</> : <>
            {ibsRef ? <><b>{scenario?.quick?.reduction?'Referência considerando o tratamento selecionado.':'Referência nominal da regra geral, sem redução.'}</b> {date.startsWith('2026') ? <>Em 2026 há exceções e dispensa de recolhimento condicionada às obrigações acessórias (<LawLink article="art. 348"/>).</> : <>IBS de 2027–2028: <LawLink article="art. 344"/>. {cbsRef?'A sugestão de CBS a zero decorre da regra do item, não de uma alíquota geral.':'Não há sugestão de CBS para esta data.'}</>}</> : 'Sem referência local para esta data. Consulte a legislação antes de informar os percentuais.'} Valores manuais não são validados como alíquotas legais. Revisão: 18/11/2026.
          </>}</Notice></div>
          {!simple && !scenario && <label className="check span-all"><input type="checkbox" checked={useIS} onChange={e=>{setUseIS(e.target.checked);clear()}}/> Incluir Imposto Seletivo ad valorem</label>}
          {useIS&&<><Field label="Base própria do IS (R$)"><MoneyInput value={isBase} onValueChange={v=>{setIsBase(v);clear()}}/></Field><Field label="Alíquota do IS (%)"><input required inputMode="decimal" value={isRate} onChange={e=>{setIsRate(e.target.value);clear()}}/></Field>
            <small className="span-all fineprint">Hipótese manual sem alíquota sugerida nem parcela por unidade. Confira bem ou serviço, vigência e base própria. <LawLink article="arts. 409, 414 e 419"/>.</small></>}
        </>}
      </div>{err&&<Notice tone="error">{err}</Notice>}
      {quick && <div className="actions calc-actions"><button className="btn primary" disabled={!canEstimate}><Calc size={16}/> Calcular estimativa</button></div>}
    </form><aside className="panel form-panel calc-result"><div className="block-title"><Tile icon={Layers3} color="blue"/><div><h2>{quick?'Resumo do cálculo':'Consulta especializada'}</h2><p>{quick?'Bases, percentuais e premissas':'Sem estimativa linear para este cenário'}</p></div></div>
      {result?<div aria-live="polite"><SimulationMemory o={result}/><div className="stack memory-actions"><button className="btn goldbtn full" disabled={busy||savedId===result.id} onClick={store}>{savedId===result.id?<BookmarkCheck size={16}/>:<Save size={16}/>}{savedId===result.id?'Simulação salva':busy?'Salvando…':'Salvar simulação'}</button>
        <button className="btn" onClick={()=>download(JSON.stringify(result,null,2),'memoria-'+result.id+'.json')}><Download size={15}/> Baixar memória</button></div>{savedId===result.id&&<button className="textbtn next-link" onClick={()=>navigate('historico')}>Abrir histórico <ChevronRight size={15}/></button>}
      </div>:quick?<div className="waiting"><RotateCcw size={26}/><h3>Aguardando os parâmetros</h3><p>{scenario&&!confirmed?'Confira a data e as condições do cenário para liberar os campos.':'Informe a base e os percentuais para ver como cada valor é calculado.'}</p></div>:<div className="waiting"><Landmark size={26}/><h3>Use o contrato do motor</h3><p>O modelo leva a classificação escolhida, não alíquotas de exemplo. Complete os dados reais e confira os estados e a memória por item na resposta.</p></div>}
    </aside></div>}</>;
}
