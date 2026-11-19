import {LawLink} from '../components/LawLink';
import {useEffect,useState} from 'react';
import {ClipboardCheck,ExternalLink,RotateCcw} from 'lucide-react';
import {Notice,PageHeading,Tile} from '../components/ui';
import {reviewItems} from '../lib/review';
import {useSpace} from '../lib/workspace';
import {PeriodPicker} from './Dashboard';
export default function Review(){
 const {session,period}=useSpace();const key=`eleao-revisao-v1:${session?.user.id}:${period}`;
 const [done,setDone]=useState<string[]>([]),[storage,setStorage]=useState(true);
 useEffect(()=>{try{const data=JSON.parse(sessionStorage.getItem(key)||'[]');setDone(Array.isArray(data)?data.filter(x=>typeof x==='string'&&reviewItems.some(i=>i.id===x)):[]);setStorage(true)}catch{setDone([]);setStorage(false)}},[key]);
 function update(next:string[]){setDone(next);try{sessionStorage.setItem(key,JSON.stringify(next));setStorage(true)}catch{setStorage(false)}}
 return <><PageHeading kicker="EMPRESAS E ESCRITÓRIOS" title="Roteiro de revisão" desc="Organize uma revisão preliminar para a competência selecionada." action={<PeriodPicker/>}/><Notice>Roteiro orientativo, não exaustivo e sem prazos automáticos. A aplicabilidade varia por entidade, regime e período. Consulte a legislação vigente e o profissional responsável. As fontes são links oficiais, não monitoramento automático.</Notice><section className="panel" style={{marginTop:20}}><header className="panel-head"><div><h2>Checklist técnico</h2><p>Marcação local desta aba para {period}; não é compartilhada nem comprova o cumprimento das obrigações.</p></div><span className="count-badge">{done.length} / {reviewItems.length}</span></header>{!storage&&<Notice tone="error">Armazenamento da aba indisponível. As marcações podem ser perdidas.</Notice>}<div className="draft-list">{reviewItems.map(i=><div key={i.id}><Tile icon={ClipboardCheck} color="blue"/><span className="grow"><b>{i.title}</b><small>{i.area} · {i.description}</small><a href={i.source} target="_blank" rel="noopener noreferrer">{i.authority} <ExternalLink size={12}/></a>{i.law && <small>Base legal: <LawLink {...i.law}/>.</small>}</span><label className="check"><input type="checkbox" checked={done.includes(i.id)} onChange={e=>update(e.target.checked?[...done,i.id]:done.filter(x=>x!==i.id))}/><span>Revisado</span></label></div>)}</div><div className="actions" style={{padding:16}}><button className="btn" onClick={()=>update([])}><RotateCcw size={15}/> Limpar marcações desta competência</button></div></section></>;
}
