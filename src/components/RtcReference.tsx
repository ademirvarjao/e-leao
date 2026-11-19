import {useState} from 'react';
import {BookOpen} from 'lucide-react';
import {readableDate,validDate} from '../lib/fiscal';
import {catalogSource} from '../lib/scenarios';
import {completeCode,readCode,referenceEdition,type CodeReference,type Nomenclature} from '../lib/rtcReference';
import {Field} from './ui';
import {checkPublishedDbVersion,friendly} from '../lib/client';
import {useSpace} from '../lib/workspace';

type Props={kind:Nomenclature;code:string;date:string};
export function ReferenceCheck(props:Props) {
  // Replacing the request-bound result also discards a late response after a field edit.
  return <Lookup key={`${props.kind}:${props.code}:${props.date}`} {...props}/>;
}
function Lookup({kind,code,date}:Props) {
  const [loading,setLoading]=useState(false), [failed,setFailed]=useState(false), [result,setResult]=useState<CodeReference|null>();
  async function check() {
    setLoading(true);setFailed(false);setResult(undefined);
    try {setResult(await readCode(kind,code,date))} catch {setFailed(true)} finally {setLoading(false)}
  }
  return <div className="rtc-reference-result">
    <button type="button" className="textbtn" disabled={loading || !validDate(date) || !completeCode(kind,code)} onClick={check}><BookOpen size={15}/>{loading?'Consultando tabela…':`Conferir ${kind.toUpperCase()} na base pública`}</button>
    <div aria-live="polite">{failed?<p>Não foi possível carregar a tabela desta edição. Tente novamente. Isso não indica falha no motor fiscal.</p>:result===undefined?null:<>
      {result?<><p><b>{result.entry.code} · {result.entry.label}</b></p>
        {result.parents.length>0 && <details><summary>Hierarquia do código</summary><ul>{result.parents.map(p=><li key={p.code}>{p.code} · {p.label}</li>)}</ul></details>}
        <p>{result.inPeriod?'Vigente':'Fora da vigência'} na tabela em {readableDate(date)}. Início: {readableDate(result.entry.from)}{result.entry.until && result.entry.until!=='9999-12-31'?` · Fim: ${readableDate(result.entry.until)}`:''}.</p></>:<p>Código não encontrado nesta edição da base pública.</p>}
      <p className="fineprint"><a href={catalogSource} target="_blank" rel="noreferrer">Receita Federal · RTC {referenceEdition.version}</a> · base de {readableDate(referenceEdition.date)}. A nomenclatura não confirma enquadramento nem alíquota.</p>
    </>}</div>
  </div>;
}
function VersionCheck() {
  const {session,auth}=useSpace(), [busy,setBusy]=useState(false), [message,setMessage]=useState('');
  async function compare() {
    if(!session) {auth('login');return}
    setBusy(true);setMessage('');
    try {
      const remote=await checkPublishedDbVersion();
      setMessage(`Versão informada pelo piloto: ${remote}. ${remote===referenceEdition.version?'Coincide com a edição desta tabela.':'Difere da edição desta tabela. Os dados locais não foram substituídos.'}`);
    } catch(e) {setMessage(friendly(e))} finally {setBusy(false)}
  }
  return <div className="rtc-service-check"><b>Edição local: {referenceEdition.version} · {readableDate(referenceEdition.date)}</b><br/>
    <button type="button" className="textbtn" disabled={busy} onClick={compare}>{busy?'Consultando versão…':'Comparar versão com o piloto da Receita'}</button>
    <small>Consulta apenas a versão publicada, sem enviar o código ou a data. Usa uma consulta da cota.</small><div aria-live="polite">{message}</div>
  </div>;
}
export function ReferencePanel({date}:{date:string}) {
  const [kind,setKind]=useState<Nomenclature>('ncm'), [code,setCode]=useState('');
  return <details className="panel rtc-reference-panel"><summary><BookOpen size={17}/> Consultar base pública da Receita · NCM e NBS</summary>
    <p>Confira a descrição e a vigência do código na data do fato gerador. A tabela vem da base publicada com o RTC; não é uma consulta em tempo real. Funciona sem o motor e não envia dados da operação.</p>
    <div className="form-grid"><Field label="Tabela pública"><select value={kind} onChange={e=>{setCode('');setKind(e.target.value as Nomenclature)}}><option value="ncm">NCM · mercadorias</option><option value="nbs">NBS · serviços</option></select></Field>
      <Field label={`Código a conferir (${kind==='ncm'?8:9} dígitos)`}><input inputMode="numeric" maxLength={kind==='ncm'?8:9} value={code} onChange={e=>setCode(e.target.value)} placeholder="Somente números"/></Field></div>
    <ReferenceCheck kind={kind} code={code} date={date}/>
    <VersionCheck/>
  </details>;
}
