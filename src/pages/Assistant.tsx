import {useEffect,useRef,useState} from 'react';
import {BookOpen,Download,ExternalLink,MessageSquareText,Send,ShieldCheck,Sparkles,ThumbsDown,ThumbsUp,Trash2} from 'lucide-react';
import {Notice,PageHeading,Tile} from '../components/ui';
import {useSpace} from '../lib/workspace';
import {friendly} from '../lib/client';
import {safeUrl} from '../lib/knowledge';
import {transitionGuide} from '../lib/rateReferences';
import {checkedAnswer,guideContext,inferGuide,makePrompt,noGuide,type LocalModel,type ModelLoader} from '../lib/assistant';
import type {Article} from '../lib/types';
import {modelBytes,modelPage} from '../lib/modelSpec';

type Reply = {text:string; sources:Article[]; mode:'Guia revisado'|'IA local'|'Consulta aos guias'};
type Message = {id:number; text:string; reply?:Reply; vote?:boolean};
type Job = {controller:AbortController; timer:ReturnType<typeof setTimeout>; fallback?:Reply};
const openModel: ModelLoader = async (...args) => (await import('../lib/localModel')).loadLocalModel(...args);

export default function Assistant({loadModel=openModel}:{loadModel?:ModelLoader}) {
  const {knowledge,feedback,notify} = useSpace();
  const [messages,setMessages] = useState<Message[]>([]), [input,setInput] = useState('');
  const [phase,setPhase] = useState<'guides'|'loading'|'ready'|'answering'>('guides');
  const [notice,setNotice] = useState(''), [progress,setProgress] = useState(0), [removing,setRemoving] = useState(false);
  const nextId = useRef(0), model = useRef<LocalModel|null>(null), active = useRef<Job|null>(null), log = useRef<HTMLDivElement>(null);
  const canAsk = phase!=='answering'&&!removing;
  const busy = phase==='loading'||!canAsk;
  const ready = phase==='ready'||phase==='answering';
  function release() {model.current?.close(); model.current=null}
  useEffect(()=>()=>{
    const job=active.current; active.current=null;
    if(job){clearTimeout(job.timer);job.controller.abort()} release();
  },[]);
  useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight},[messages.length,phase]);
  function append(reply:Reply) {const id=++nextId.current;setMessages(list=>[...list,{id,text:reply.text,reply}])}
  function stop(message:string) {
    const job=active.current; active.current=null;
    if(job){clearTimeout(job.timer);job.controller.abort();if(job.fallback)append(job.fallback)}
    release();setPhase('guides');setNotice(message);
  }
  function isCurrent(job: Job) {return active.current===job}
  function start(fallback?:Reply): Job {
    const controller=new AbortController();
    const timer=setTimeout(()=>stop('Tempo de espera esgotado. A consulta aos guias continua disponível.'),fallback?120_000:600_000);
    const job={controller,timer,fallback};active.current=job;return job;
  }
  function end(job:Job) {clearTimeout(job.timer);if(isCurrent(job))active.current=null}

  async function enable() {
    if(active.current||model.current||removing)return;
    const job=start();setProgress(0);setPhase('loading');setNotice('');
    try {
      const engine=await loadModel(job.controller.signal,p=>{if(isCurrent(job))setProgress(p)});
      if(!isCurrent(job)){engine.close();return}
      model.current=engine;setPhase('ready');
    } catch (e) {
      if(!isCurrent(job))return;
      setPhase('guides');setNotice(e instanceof Error&&(e.message==='storage'||e.name==='QuotaExceededError')
        ?'Não há espaço disponível para o modelo. Libere ao menos 400 MB de armazenamento para o site ou continue no modo guias.'
        : e instanceof Error&&e.message==='unsupported'
        ?'Este navegador não oferece os recursos para IA local. Use um navegador atualizado, em HTTPS, ou consulte os guias abaixo.'
        :'Não foi possível preparar a IA. Confira a conexão, o espaço livre e as permissões de armazenamento do navegador. Você pode tentar novamente ou consultar os guias.');
    } finally {end(job)}
  }
  async function removeModel() {
    if (busy || active.current) return;
    release();setPhase('guides');setRemoving(true);
    try {await (await import('../lib/localModel')).removeCachedModel();setNotice('Cache do modelo removido. Sua conta e suas operações não foram alteradas.')}
    catch {setNotice('Não foi possível acessar o cache do modelo neste navegador.')} finally {setRemoving(false)}
  }
  async function ask(value:string) {
    const question=value.trim().slice(0,1000);if(!question||active.current?.fallback||removing)return;
    const previous=messages.at(-1)?.reply?.sources[0];
    let sources=guideContext(question,knowledge,previous);
    const fallback:Reply={text:sources[0]?.answer||noGuide,sources:sources.slice(0,1),mode:sources.length?'Guia revisado':'Consulta aos guias'};
    const id=++nextId.current;setMessages(list=>[...list,{id,text:question}]);setInput('');
    const engine=model.current;if(!engine){append(fallback);return}
    const job=start(fallback);setNotice('');setPhase('answering');
    try {
      if (!sources.length) {
        const inferred=await inferGuide(engine,question,knowledge,job.controller.signal);
        if(!isCurrent(job))return;
        if(!inferred){append(fallback);setPhase('ready');return}
        sources=[inferred];job.fallback={text:inferred.answer,sources,mode:'Guia revisado'};
      }
      const text=checkedAnswer(await engine.complete(makePrompt(question,sources,previous ? messages.at(-2)?.text : undefined),job.controller.signal),sources);
      if(!isCurrent(job))return;
      if(text)append({text,sources,mode:'IA local'});
      else {append(job.fallback ?? fallback);setNotice('Não foi possível confirmar o texto gerado. Mostramos a consulta aos guias em vez da resposta da IA.')}
      setPhase('ready');
    } catch {
      if(isCurrent(job))stop('A geração local falhou. Mostramos a consulta aos guias para a mesma pergunta.');
    } finally {end(job)}
  }
  async function vote(id:number,article:string,helpful:boolean) {
    try {await feedback(article,helpful);setMessages(list=>list.map(m=>m.id===id?{...m,vote:helpful}:m))} catch(e){notify(friendly(e))}
  }
  const starters=[transitionGuide,...knowledge.filter(a=>a.id==='guia-1'||a.id==='guia-3')];
  return <><PageHeading kicker="INTELIGÊNCIA FISCAL" title="Assistente fiscal" desc="Faça uma pergunta e confira os guias que fundamentam a resposta."/>
    <section className="panel model-card" aria-label="Modelo de inteligência artificial">
      <div className="block-title"><Tile icon={Sparkles} color="lavender"/><div><h2>IA gratuita no dispositivo</h2><p>Qwen3-0.6B · Sem chave de API e sem cobrança por pergunta.</p></div></div>
      <p className="model-explainer">Na primeira ativação, o navegador baixa cerca de {Math.round(modelBytes/1e6)} MB de pesos do Hugging Face e os mantém em cache, se houver espaço. As perguntas e os guias não saem do dispositivo para gerar respostas.</p>
      <div className="actions">{phase==='guides'?<button className="btn primary" disabled={removing} onClick={enable}><Download size={16}/> Ativar IA neste dispositivo</button>:phase==='ready'?<><span className="tag green">Modelo pronto</span><button className="btn" onClick={()=>stop('IA desativada; os guias continuam disponíveis.')}>Usar só os guias</button></>:<><span role="status">{phase==='loading'?(progress>=100?'Inicializando o modelo…':`Carregando modelo · ${progress}%`):'Gerando resposta no dispositivo…'}</span><button className="btn" onClick={()=>stop(phase==='loading'?'Ativação cancelada. Você pode consultar os guias.':'Geração interrompida. Mostramos a consulta aos guias.')}>Cancelar</button></>}</div>
      {phase==='loading'&&<progress aria-label="Carregamento do modelo" max={100} value={progress}/>}
      <details className="model-storage"><summary>Modelo e armazenamento</summary><p>Pesos abertos Q4_K_M, quantizados por Unsloth. A velocidade depende da memória e do processador. <a href={modelPage} target="_blank" rel="noreferrer">Consultar versão do modelo</a></p><button type="button" className="textbtn" disabled={busy} onClick={removeModel}>{removing?'Removendo…':'Apagar apenas o modelo em cache'}</button></details>
      {notice&&<div role="status"><Notice>{notice}</Notice></div>}
    </section>
    <section className="panel chat"><header className="panel-head"><div className="block-title"><Tile icon={MessageSquareText} color="blue"/><div><h2>Conversa fiscal</h2><p>{ready?'IA local · Confira a resposta nas fontes':'Modo guias · Consulta imediata, sem geração por IA'}</p></div></div>
      {!!messages.length&&<button className="iconbtn" disabled={busy} aria-label="Limpar conversa" onClick={()=>{setMessages([]);setInput('');setNotice('')}}><Trash2 size={17}/></button>}</header>
      <div ref={log} className="chat-log" role="log" aria-label="Mensagens" aria-live="polite" aria-relevant="additions">
        {!messages.length&&<div className="chat-welcome"><span className="assistant-orb"><BookOpen size={28}/></span><h2>O que você quer conferir?</h2><p>Indique o tributo ou o documento e, se fizer diferença, o ano da operação.</p><div className="suggestions">{starters.map(a=><button disabled={!canAsk} key={a.id} onClick={()=>ask(a.question)}>{a.question}</button>)}</div></div>}
        {messages.map(m=><div className={'bubble '+(m.reply?'agent':'user')} key={m.id}><small>{m.reply?`e-Leão · ${m.reply.mode}`:'Você'}</small><p>{m.text}</p>
          {m.reply&&m.reply.sources.length>0&&<span className="source-caption">{m.reply.mode==='IA local'?'Fontes consultadas':'Fonte do guia'}</span>}
          {m.reply?.sources.map((a,i)=><div className="bubble-foot" key={a.id}><a href={safeUrl(a.source)} target="_blank" rel="noreferrer"><BookOpen size={14}/>{a.question}<ExternalLink size={12}/></a>
            {i===0&&a.id!==transitionGuide.id&&<div><button aria-label="Guia útil" aria-pressed={m.vote===true} className="iconbtn" onClick={()=>vote(m.id,a.id,true)}><ThumbsUp size={14}/></button><button aria-label="Guia pouco útil" aria-pressed={m.vote===false} className="iconbtn" onClick={()=>vote(m.id,a.id,false)}><ThumbsDown size={14}/></button></div>}</div>)}
        </div>)}
      </div><div className="composer"><form onSubmit={e=>{e.preventDefault();ask(input)}}><input aria-label="Sua pergunta" placeholder="Pergunte sobre IBS, CBS ou NFS-e…" required maxLength={1000} value={input} onChange={e=>setInput(e.target.value)}/><button className="btn primary" aria-label="Enviar pergunta" disabled={!canAsk||!input.trim()}><Send size={17}/></button></form></div>
    </section><p className="privacy-foot"><ShieldCheck size={15}/> Conversa apenas nesta tela. A IA pode errar; confira a fonte e a vigência. Não é parecer fiscal.</p></>;
}
