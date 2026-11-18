import {useEffect,useState} from 'react';
import {ExternalLink,RefreshCw} from 'lucide-react';
import {Notice,Tile} from './ui';
type Feed={id:string;name:string;url:string;ok:boolean;items:{title:string;url:string;date:string}[]};
type Data={checkedAt:string;feeds:Feed[]};
function official(url:string){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='www.gov.br'&&!u.username&&!u.password&&(u.port===''||u.port==='443')}catch{return false}}
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)}
export function isFeedData(data:unknown):data is Data {
 return record(data)&&typeof data.checkedAt==='string'&&Number.isFinite(Date.parse(data.checkedAt))&&Array.isArray(data.feeds)&&
   data.feeds.every(f=>record(f)&&typeof f.id==='string'&&typeof f.name==='string'&&typeof f.url==='string'&&typeof f.ok==='boolean'&&Array.isArray(f.items)&&
    f.items.every(i=>record(i)&&typeof i.title==='string'&&typeof i.url==='string'&&typeof i.date==='string'));
}
export default function OfficialUpdates(){const [data,setData]=useState<Data|null>(null),[error,E]=useState(false),[attempt,retry]=useState(0);
 useEffect(()=>{const controller=new AbortController();E(false);
   fetch(`${import.meta.env.BASE_URL}official-updates.json`,{signal:controller.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()})
   .then(v=>{if(!isFeedData(v))throw Error();if(!controller.signal.aborted)setData(v)}).catch(()=>{if(!controller.signal.aborted)E(true)});
   return()=>controller.abort()},[attempt]);
 const time=data?Date.parse(data.checkedAt):0,stale=!!data&&(Date.now()-time>48*60*60*1000||time>Date.now()+300000);
 return <section className="panel" style={{marginBottom:20}}><header className="panel-head"><div className="block-title"><Tile icon={RefreshCw} color="blue"/><div><h2>Notícias das fontes oficiais</h2><p>Consulta diária programada dos feeds da Receita Federal · não altera automaticamente os guias ou cálculos.</p></div></div></header>{error?<Notice tone="error">Atualizações indisponíveis. Consulte diretamente os portais oficiais; não há confirmação de atualização recente. <button className="textbtn" onClick={()=>retry(n=>n+1)}>Tentar novamente</button> · <a target="_blank" rel="noreferrer" href="https://www.gov.br/receitafederal/pt-br/assuntos/noticias">Abrir notícias da Receita</a></Notice>:!data?<p className="fineprint" style={{padding:18}}>Carregando fontes…</p>:<div style={{padding:'0 20px 18px'}}><p className="fineprint">Última tentativa: {new Date(data.checkedAt).toLocaleString('pt-BR')} · Horário do seu dispositivo.</p>{stale&&<Notice tone="error">A última tentativa tem mais de 48 horas ou está em horário futuro. Verifique a rotina e consulte as fontes diretamente.</Notice>}{data.feeds.map(f=><div key={f.id} className="inset" style={{marginTop:10}}><b>{f.name}</b>{!f.ok?<p>Consulta falhou nesta tentativa. Acesse a fonte diretamente.</p>:!f.items.length?<p>Nenhuma notícia disponível no feed nesta consulta.</p>:<ul>{f.items.slice(0,5).filter(i=>official(i.url)).map(i=><li key={i.url}><a href={i.url} target="_blank" rel="noopener noreferrer">{i.title} <ExternalLink size={12}/></a>{i.date&&<small> · {i.date}</small>}</li>)}</ul>}{official(f.url)&&<a href={f.url} target="_blank" rel="noopener noreferrer">Abrir feed oficial <ExternalLink size={12}/></a>}</div>)}</div>}</section>
}
