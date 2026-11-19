import {Fragment,useCallback,useEffect,useRef,useState} from 'react';
import {BookOpen,ExternalLink,LoaderCircle,MessageSquareText,Send,ShieldCheck,Sparkles,ThumbsDown,ThumbsUp,Trash2} from 'lucide-react';
import {Notice,PageHeading,Tile} from '../components/ui';
import {useSpace} from '../lib/workspace';
import {friendly} from '../lib/client';
import {safeUrl} from '../lib/knowledge';
import {transitionGuide} from '../lib/rateReferences';
import {answerIdleMs,answerLimitMs,checkedAnswer,guideContext,inferGuide,makePrompt,noGuide,sameQuestion,type ModelLoader,type ModelProgress} from '../lib/assistant';
import {useDeviceModel} from '../lib/useDeviceModel';
import type {Article} from '../lib/types';
import {modelBytes,modelPage} from '../lib/modelSpec';

type Reply = {text:string; sources:Article[]; mode:'Guia revisado'|'IA local'|'Consulta aos guias'};
type Turn = {id:number; question:string; reply:Reply; vote?:boolean};
type Request = {id:number; question:string; sources:Article[]; knowledge:Article[]; previousQuestion?:string};
const reviewed = (sources:Article[]):Reply => ({text:sources[0]?.answer||noGuide,sources:sources.slice(0,1),mode:sources.length?'Guia revisado':'Consulta aos guias'});

export default function Assistant({loadModel}:{loadModel?:ModelLoader}) {
  const {knowledge,feedback,notify} = useSpace();
  const {state,retry,pause,recover} = useDeviceModel(loadModel);
  const [turns,setTurns] = useState<Turn[]>([]), [input,setInput] = useState('');
  const [request,setRequest] = useState<Request|null>(null), [stage,setStage] = useState<'reading'|'writing'>('reading');
  const [notice,setNotice] = useState(''), [removing,setRemoving] = useState(false);
  const nextId = useRef(0), running = useRef<AbortController|null>(null), deletion = useRef<symbol|null>(null), log = useRef<HTMLDivElement>(null);
  const answering = !!request && state.kind==='ready';
  const last=turns.at(-1);
  useEffect(()=>()=>{deletion.current=null},[]);
  useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight},[last?.id,last?.reply,request?.id]);

  const interrupt = useCallback((message:string)=>{
    running.current?.abort();setRequest(null);setNotice(message);recover();
  },[recover]);
  useEffect(()=>{
    if(!request)return;
    if(state.kind==='loading')return; // Answer from the guide now; explain the latest free question once ready.
    if(state.kind!=='ready'){setRequest(null);return}
    const {engine}=state, {id,question,knowledge:catalog,previousQuestion}=request;
    const ctrl=new AbortController(), {signal}=ctrl; running.current=ctrl;
    let sources=request.sources;
    const timeout=()=>{if(!signal.aborted)interrupt('A IA demorou para concluir. A consulta aos guias foi mantida; você já pode fazer outra pergunta.')};
    const deadline=setTimeout(timeout,answerLimitMs);let idle=setTimeout(timeout,answerIdleMs);
    function heartbeat(){clearTimeout(idle);idle=setTimeout(timeout,answerIdleMs)}
    const onProgress:ModelProgress=next=>{if(!signal.aborted){heartbeat();setStage(next)}};
    function update(reply:Reply){if(!signal.aborted)setTurns(list=>list.map(t=>t.id===id?{...t,reply}:t))}
    async function explain(){
      try {
        if(!sources.length){
          const inferred=await inferGuide(engine,question,catalog,signal,()=>{if(!signal.aborted)heartbeat()});
          if(signal.aborted||!inferred)return;
          sources=[inferred];update(reviewed(sources));heartbeat();
        }
        const output=await engine.complete(makePrompt(question,sources,previousQuestion),signal,undefined,onProgress);
        if(signal.aborted)return;
        const text=checkedAnswer(output,sources);
        if(text)update({text,sources,mode:'IA local'});
        else setNotice('Não foi possível confirmar a explicação gerada. Mantivemos o texto do guia e sua fonte.');
      } catch {
        if(!signal.aborted)interrupt('A geração local falhou. Mantivemos a consulta aos guias para esta pergunta.');
      } finally {
        clearTimeout(deadline);clearTimeout(idle);
        if(!signal.aborted)setRequest(null);
      }
    }
    void explain();
    return ()=>{ctrl.abort();clearTimeout(deadline);clearTimeout(idle);if(running.current===ctrl)running.current=null};
  },[request,state,interrupt]);

  function ask(value:string) {
    const question=value.trim().slice(0,1000);if(!question)return;
    const previous=turns.at(-1), sources=guideContext(question,knowledge,previous?.reply.sources[0]);
    const id=++nextId.current;
    // Publish the question AND its reviewed result in the same render. Completing,
    // timing out or cancelling a model task never appends a second reply.
    setTurns(list=>[...list,{id,question,reply:reviewed(sources)}]);setInput('');setNotice('');
    if(sources[0]&&sameQuestion(question,sources[0].question))return; // Direct answers don't compete for the worker.
    // A new free question takes precedence without requiring a click on Cancel.
    // Never submit a second task to a worker whose previous request may still be running.
    if(answering){running.current?.abort();recover()}
    setStage('reading');setRequest(state.kind==='ready'||state.kind==='loading' ? {id,question,sources,knowledge,previousQuestion:previous?.reply.sources[0]?previous.question:undefined} : null);
  }
  function onlyGuides(){setRequest(null);pause();setNotice('Modo só guias. A conversa continua disponível sem o modelo.')}
  async function removeModel() {
    if(answering||state.kind==='loading'||deletion.current)return;
    const key=Symbol();deletion.current=key;setRemoving(true);setRequest(null);pause();setNotice('');
    try {await (await import('../lib/localModel')).removeCachedModel();if(deletion.current===key)setNotice('Cache do modelo removido. O modo só guias evita um novo download automático.')}
    catch {if(deletion.current===key)setNotice('Não foi possível acessar o cache do modelo neste navegador.')}
    finally {if(deletion.current===key){deletion.current=null;setRemoving(false)}}
  }
  async function vote(id:number,article:string,helpful:boolean) {
    try {await feedback(article,helpful);setTurns(list=>list.map(t=>t.id===id?{...t,vote:helpful}:t))} catch(e){notify(friendly(e))}
  }
  const starters=[transitionGuide,...knowledge.filter(a=>a.id==='guia-1'||a.id==='guia-3')];
  return <><PageHeading kicker="INTELIGÊNCIA FISCAL" title="Assistente fiscal" desc="Faça uma pergunta e confira os guias que fundamentam a resposta."/>
    <section className="panel model-card" aria-label="Modelo de inteligência artificial">
      <div className="block-title"><Tile icon={Sparkles} color="lavender"/><div><h2>IA gratuita no dispositivo</h2><p>Qwen3-0.6B · Sem chave de API e sem cobrança por pergunta.</p></div></div>
      <p className="model-explainer">Por padrão, a IA carrega automaticamente ao abrir o assistente. O primeiro download é de cerca de {Math.round(modelBytes/1e6)} MB; nas próximas visitas, o navegador reutiliza os pesos se estiverem em cache. As perguntas e os guias não saem do dispositivo para gerar respostas.</p>
      <div className="actions">{state.kind==='loading'?<><span role="status">{state.percent>=100?'Inicializando o modelo…':`Preparando a IA · ${state.percent}%`}. Você já pode perguntar.</span><button className="btn" onClick={onlyGuides}>Usar só os guias</button></>:state.kind==='ready'?<>
        <span className="tag green">{answering?'IA em uso':'Modelo pronto'}</span>{answering?<button className="btn" onClick={()=>interrupt('Explicação interrompida. A consulta aos guias continua na conversa.')}>Cancelar explicação</button>:<button className="btn" onClick={onlyGuides}>Usar só os guias</button>}
      </>:<><span className="tag">{state.kind==='guides'?'Modo só guias':'IA indisponível'}</span><button className="btn" disabled={removing} onClick={()=>{setNotice('');retry()}}>{state.kind==='guides'?'Voltar a usar a IA':'Tentar carregar a IA novamente'}</button>{state.kind==='error'&&<button className="btn" onClick={onlyGuides}>Usar só os guias</button>}</>}</div>
      {state.kind==='loading'&&<progress aria-label="Carregamento do modelo" max={100} value={state.percent}/>}
      <details className="model-storage"><summary>Modelo e armazenamento</summary><p>Pesos abertos Q4_K_M, quantizados por Unsloth. A velocidade depende da memória e do processador. <a href={modelPage} target="_blank" rel="noreferrer">Consultar versão do modelo</a></p><button type="button" className="textbtn" disabled={answering||state.kind==='loading'||removing} onClick={removeModel}>{removing?'Removendo…':'Apagar apenas o modelo em cache'}</button></details>
      {(state.kind==='error'||notice)&&<div role="status"><Notice>{state.kind==='error'?state.message:notice}</Notice></div>}
    </section>
    <section className="panel chat"><header className="panel-head"><div className="block-title"><Tile icon={MessageSquareText} color="blue"/><div><h2>Conversa fiscal</h2><p>{state.kind==='ready'?'IA local · Perguntas dos guias têm resposta direta':'Consulta imediata aos guias revisados'}</p></div></div>
      {!!turns.length&&<button className="iconbtn" disabled={answering} aria-label="Limpar conversa" onClick={()=>{setTurns([]);setRequest(null);setInput('');setNotice('')}}><Trash2 size={17}/></button>}</header>
      <div ref={log} className="chat-log" role="log" aria-label="Mensagens" aria-live="polite" aria-relevant="additions text">
        {!turns.length&&<div className="chat-welcome"><span className="assistant-orb"><BookOpen size={28}/></span><h2>O que você quer conferir?</h2><p>Indique o tributo ou o documento e, se fizer diferença, o ano da operação.</p><div className="suggestions">{starters.map(a=><button key={a.id} onClick={()=>ask(a.question)}>{a.question}</button>)}</div></div>}
        {turns.map(({id,question,reply,vote:rating})=>{
          const pending=request?.id===id && (state.kind==='loading'||answering);
          return <Fragment key={id}><div className="bubble user"><small>Você</small><p>{question}</p></div><div className="bubble agent"><small>e-Leão · {reply.mode}</small>
            <p>{pending&&!reply.sources.length?'Ainda não encontrei um guia na busca por palavras.':reply.text}</p>
            {reply.sources.length>0&&<span className="source-caption">{reply.mode==='IA local'?'Fontes consultadas':'Fonte do guia'}</span>}
            {reply.sources.map((a,i)=><div className="bubble-foot" key={a.id}><a href={safeUrl(a.source)} target="_blank" rel="noreferrer"><BookOpen size={14}/>{a.question}<ExternalLink size={12}/></a>
              {i===0&&a.id!==transitionGuide.id&&<div><button aria-label="Guia útil" aria-pressed={rating===true} className="iconbtn" onClick={()=>vote(id,a.id,true)}><ThumbsUp size={14}/></button><button aria-label="Guia pouco útil" aria-pressed={rating===false} className="iconbtn" onClick={()=>vote(id,a.id,false)}><ThumbsDown size={14}/></button></div>}</div>)}
            {pending&&<span className="reply-progress" role="status"><LoaderCircle size={13} className="spin"/>{state.kind==='loading'?'Aguardando a IA para explicar a pergunta mais recente…':!reply.sources.length?'A IA está procurando uma fonte revisada…':stage==='writing'?'A IA está redigindo a explicação…':'A IA está lendo as fontes…'}</span>}
          </div></Fragment>;
        })}
      </div><div className="composer"><form onSubmit={e=>{e.preventDefault();ask(input)}}><input aria-label="Sua pergunta" placeholder="Pergunte sobre IBS, CBS ou NFS-e…" required maxLength={1000} value={input} onChange={e=>setInput(e.target.value)}/><button className="btn primary" aria-label="Enviar pergunta" disabled={!input.trim()}><Send size={17}/></button></form></div>
    </section><p className="privacy-foot"><ShieldCheck size={15}/> Conversa apenas nesta tela. A IA pode errar; confira a fonte e a vigência. Não é parecer fiscal.</p></>;
}
