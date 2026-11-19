import {useState, type FormEvent} from 'react';
import {ArrowRight, Code2, Download} from 'lucide-react';
import {friendly, queryRTC} from '../lib/client';
import {download} from '../lib/fiscal';
import {rtcExamples, rtcStatus, type Engine} from '../lib/rtc';
import {hasPlaceholders, scenarioPacket} from '../lib/scenarioPacket';
import {documentOptions, scenarioCode, type Scenario} from '../lib/scenarios';
import {useSpace} from '../lib/workspace';
import {Field, Notice, Tile} from './ui';
import {LawLink} from './LawLink';

export function RtcConsultation({scenario, date}: {scenario?: Scenario; date:string}) {
  const {session, auth} = useSpace();
  const [packet] = useState(() => scenario && scenarioPacket(scenario,date));
  const [engine,setEngine] = useState<Engine>(packet?.engine ?? 'regular');
  const [text,setText] = useState(() => JSON.stringify(packet?.operation ?? rtcExamples.regular,null,2));
  const [result,setResult] = useState<Awaited<ReturnType<typeof queryRTC>> | null>(null);
  const [err,setErr] = useState(''), [busy,setBusy] = useState(false);
  function changeEngine(next: Engine) {
    setEngine(next); setText(JSON.stringify(packet?.engine === next ? packet.operation : rtcExamples[next],null,2)); setResult(null); setErr('');
  }
  async function run(e: FormEvent) {
    e.preventDefault(); if (busy) return;
    setErr(''); setResult(null);
    let payload;
    try {payload = JSON.parse(text)} catch {setErr('O JSON está inválido. Confira aspas, vírgulas e chaves.'); return}
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {setErr('Informe uma operação como objeto JSON.'); return}
    if (hasPlaceholders(text)) {setErr('Complete os campos marcados com <informar …> ou remova os opcionais não aplicáveis antes de consultar.'); return}
    if (!session) {auth('login'); return}
    setBusy(true);
    try {setResult(await queryRTC(engine,payload))} catch (e) {setErr(friendly(e))} finally {setBusy(false)}
  }
  return <section className="panel form-panel"><div className="block-title"><Tile icon={Code2} color="blue"/><div><h2>Consultar o motor RTC</h2><p>Revise a operação antes de enviá-la. A seleção do cenário não faz uma consulta.</p></div></div>
    <Notice>Requer conta e instância RTC configurada pelo administrador. Não inclua dados pessoais. A cobertura depende da versão do motor; um retorno parcial não é apuração oficial.</Notice>
    <form className="stack" onSubmit={run}><Field label="Serviço"><select value={engine} disabled={busy} onChange={e=>changeEngine(e.target.value as Engine)}><option value="regular">Regime regular · IBS, CBS e IS</option><option value="simple">Simples Nacional · IBS e CBS</option><option value="base">Base unificada da NFS-e</option></select></Field>
      {scenario && packet?.engine === engine ? <div className="inset"><b>Modelo para completar · {scenario.label}</b><p>{scenarioCode(scenario)} · <LawLink article={scenario.article} simple={scenario.family==='sn'}/>.</p><p>{scenario.guidance}</p>{scenario.documents.length>0 && <p>Modelos de documento vinculados no catálogo: {documentOptions(scenario)}.</p>}
        <p>Substitua <code>{'<informar …>'}</code> pelos dados da operação e inclua os grupos condicionais exigidos. Remova os campos opcionais não aplicáveis. {engine==='simple'?'Use decimais como texto, com ponto. Não copie percentuais de exemplos.':'Use números JSON nas bases e alíquotas. Confira hora, fuso, destino, NCM/NBS, quantidade e unidade quando exigidos.'}</p></div>
        : <p className="fineprint">{engine==='base'?'Exemplo de composição da base da NFS-e; não emite nem autoriza nota.':'Exemplo ilustrativo do contrato. Substitua os dados; os percentuais do exemplo não são sugestões fiscais.'}</p>}
      <Field label="Operação (JSON)"><textarea className="code" disabled={busy} required maxLength={65000} rows={13} value={text} onChange={e=>{setText(e.target.value);setResult(null);setErr('')}}/></Field>
      {err&&<Notice tone="error">{err}</Notice>}<button className="btn primary align-start" disabled={busy}>{busy?'Consultando…':session?'Consultar motor':'Entrar para consultar'}<ArrowRight size={16}/></button>
    </form>{result&&<div className="stack result"><h3>Retorno do motor · HTTP {result.status}</h3><Notice>{rtcStatus(result.body,engine)}</Notice>
      {result.warning&&<p>O gateway sinalizou dados simulados{/^\d{1,3}$/.test(result.warning)?` (aviso ${result.warning})`:''}. Não use este retorno como apuração oficial.</p>}
      {engine!=='base' && Array.isArray(result.body.objetos) && result.body.objetos.length>0 && <details className="inset" open><summary>Estados por item ({result.body.objetos.length})</summary>
        <ol className="rtc-items">{result.body.objetos.map((item,i)=><li key={i}>Item {typeof item?.nObj==='number' || typeof item?.nObj==='string' ? item.nObj : i+1}: <b>{typeof item?.estadoItem==='string'?item.estadoItem:'Estado não informado'}</b></li>)}</ol></details>}
      <details className="inset" open><summary>Memória original do motor</summary><pre>{JSON.stringify(result.body,null,2)}</pre></details>
      <button className="btn align-start" onClick={()=>download(JSON.stringify(result,null,2),'retorno-rtc.json')}><Download size={16}/> Baixar memória</button></div>}
  </section>;
}
