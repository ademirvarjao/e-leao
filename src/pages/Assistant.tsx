import {Fragment,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,ExternalLink,LoaderCircle,MessageSquareText,Send,ShieldCheck,Settings2,ThumbsDown,ThumbsUp,Trash2} from 'lucide-react';
import {Notice,PageHeading,Tile} from '../components/ui';
import {useSpace} from '../lib/workspace';
import {friendly} from '../lib/client';
import {safeUrl} from '../lib/knowledge';
import {transitionGuide} from '../lib/rateReferences';
import {answerIdleMs,answerLimitMs,checkedAnswer,inferGuide,makePrompt,noGuide,type ModelLoader,type ModelProgress} from '../lib/assistant';
import {useDeviceModel} from '../lib/useDeviceModel';
import type {Article} from '../lib/types';

import {ResearchSources} from '../components/ResearchSources';
import {createResearchSession,planAssistantTurn,makeWebPrompt,searchOfficial,webAnswer,type SearchOfficial,type SearchState} from '../lib/webResearch';
import type {WebHit} from '../../supabase/functions/_shared/research';

type Reply = {text:string; sources:Article[]; mode:'Guia revisado'|'IA local'|'Consulta aos guias'|'Trecho da pesquisa'|'IA local com fonte'|'Consulta online'; cited?:number};
type Turn = {id:number; question:string; terms:string[]; reply:Reply; research?:SearchState; vote?:boolean};
type Request = {id:number; question:string; sources:Article[]; knowledge:Article[]; hits?:WebHit[]; previousQuestion?:string};
const reviewed = (sources:Article[]):Reply => ({text:sources[0]?.answer||noGuide,sources:sources.slice(0,1),mode:sources.length?'Guia revisado':'Consulta aos guias'});

export default function Assistant({loadModel,search=searchOfficial}:{loadModel?:ModelLoader;search?:SearchOfficial}) {
  const {knowledge,feedback,notify,profile} = useSpace();
  const {state,retry,pause,recover} = useDeviceModel(loadModel);
  const [turns,setTurns] = useState<Turn[]>([]), [input,setInput] = useState('');
  const [request,setRequest] = useState<Request|null>(null), [stage,setStage] = useState<'reading'|'writing'>('reading');
  const [notice,setNotice] = useState(''), [removing,setRemoving] = useState(false);
  const nextId = useRef(0), running = useRef<AbortController|null>(null), deletion = useRef<symbol|null>(null), log = useRef<HTMLDivElement>(null);
  const canSearch=profile?.approval_status==='approved' && profile.active && state.kind!=='guides';
  const lookup=useMemo(()=>createResearchSession(search),[search]);
  useEffect(()=>()=>lookup.clear(),[lookup]);
  const answering = !!request && state.kind==='ready';
  const last=turns.at(-1);
  useEffect(()=>()=>{deletion.current=null},[]);
  useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight},[last?.id,last?.reply,last?.research,request?.id]);

  const interrupt = useCallback((message:string)=>{
    running.current?.abort();setRequest(null);setNotice(message);recover();
  },[recover]);
  useEffect(()=>{
    if(!request)return;
    if(state.kind==='loading')return; // Answer from the guide now; explain the latest free question once ready.
    if(state.kind!=='ready'){setRequest(null);return}
    const {engine}=state, {id,question,knowledge:catalog,previousQuestion,hits}=request;
    const ctrl=new AbortController(), {signal}=ctrl; running.current=ctrl;
    let sources=request.sources;
    const timeout=()=>{if(!signal.aborted)interrupt('A IA demorou para concluir. As fontes disponíveis foram mantidas; você já pode fazer outra pergunta.')};
    const deadline=setTimeout(timeout,answerLimitMs);let idle=setTimeout(timeout,answerIdleMs);
    function heartbeat(){clearTimeout(idle);idle=setTimeout(timeout,answerIdleMs)}
    const onProgress:ModelProgress=next=>{if(!signal.aborted){heartbeat();setStage(next)}};
    function update(reply:Reply){if(!signal.aborted)setTurns(list=>list.map(t=>t.id===id?{...t,reply}:t))}
    async function explain(){
      try {
        if(hits?.length){
          const raw=await engine.complete(makeWebPrompt(question,hits,previousQuestion),signal,8,onProgress);
          if(signal.aborted)return;
          const answer=webAnswer(raw,hits);
          if(answer)update({text:answer.text,cited:answer.index,mode:'IA local com fonte',sources:[]});
          else if(sources.length)update(reviewed(sources));
          else update({text:'Os trechos encontrados não permitem confirmar uma resposta direta. Confira o contexto nas fontes abaixo.',mode:'Consulta online',sources:[]});
          return;
        }
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
        if(!signal.aborted)interrupt('A geração local falhou. As fontes disponíveis continuam na conversa.');
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
    const previous=turns.at(-1), id=++nextId.current;
    lookup.cancel();
    const {sources,useModel,terms}=planAssistantTurn(question,knowledge,canSearch,previous && {
      question:previous.question,guide:previous.reply.sources[0],terms:previous.terms,
    });
    const research:SearchState|undefined=terms.length?{kind:'pending'}:undefined;
    setTurns(list=>[...list,{id,question,terms,reply:reviewed(sources),research}]);setInput('');setNotice('');
    if(!useModel && !terms.length)return; // Immediate reviewed answer; don't take the worker from another turn.
    if(answering){running.current?.abort();recover()}
    setRequest(null);setStage('reading');
    const enqueue=(hits?:WebHit[])=>{
      if(!useModel && !hits?.length)return;
      setRequest({id,question,sources,knowledge,hits,previousQuestion:(previous?.reply.sources.length || (hits && previous?.research?.kind==='found'))?previous?.question:undefined});
    };
    if(!terms.length){enqueue();return}
    lookup.run(terms,outcome=>{
      const hits=outcome.kind==='found'?outcome.data.hits:undefined;
      setTurns(list=>list.map(t=>t.id!==id?t:{...t,research:outcome,
        reply:hits?.length && !t.reply.sources.length?{text:hits[0].excerpt,cited:0,mode:'Trecho da pesquisa',sources:[]}:t.reply}));
      if(outcome.kind!=='stopped' && nextId.current===id)enqueue(hits?.length?hits:undefined);
    });
  }
  function onlyGuides(){lookup.cancel();setRequest(null);pause();setNotice('Modo só guias. As respostas vêm da base revisada.')}
  async function removeModel() {
    if(answering||state.kind==='loading'||deletion.current)return;
    const key=Symbol();lookup.cancel();deletion.current=key;setRemoving(true);setRequest(null);pause();setNotice('');
    try {await (await import('../lib/localModel')).removeCachedModel();if(deletion.current===key)setNotice('Cache do modelo removido. O modo só guias evita um novo download automático.')}
    catch {if(deletion.current===key)setNotice('Não foi possível acessar o cache do modelo neste navegador.')}
    finally {if(deletion.current===key){deletion.current=null;setRemoving(false)}}
  }
  async function vote(id:number,article:string,helpful:boolean) {
    try {await feedback(article,helpful);setTurns(list=>list.map(t=>t.id===id?{...t,vote:helpful}:t))} catch(e){notify(friendly(e))}
  }
  const starters=[transitionGuide,...knowledge.filter(a=>a.id==='guia-1'||a.id==='guia-3')];
  return <><PageHeading kicker="INTELIGÊNCIA FISCAL" title="Assistente fiscal" desc="Faça uma pergunta e confira as fontes que fundamentam a resposta."/>
    {state.kind==='loading'&&<div className="model-progress"><progress aria-label="Carregamento do assistente" max={100} value={state.percent}/><span aria-hidden="true">{state.percent}%</span></div>}
    {(state.kind==='error'||notice||state.kind==='guides')&&<div className="chat-notice" role="status"><Notice>{state.kind==='error'?state.message:notice||'Modo só guias.'} {(state.kind==='error'||state.kind==='guides')&&<button className="textbtn" disabled={removing} onClick={()=>{setNotice('');retry()}}>{state.kind==='guides'?'Voltar a usar a IA':'Tentar carregar a IA novamente'}</button>}</Notice></div>}
    <section className="panel chat" data-mode={state.kind}><header className="panel-head"><div className="block-title"><Tile icon={MessageSquareText} color="blue"/><div><h2>Conversa fiscal</h2><p>{canSearch?'Guias revisados e consulta automática a fontes oficiais':'Respostas com base nos guias revisados'}</p></div></div>
      <div className="actions">{!!turns.length&&<button className="iconbtn" disabled={answering} aria-label="Limpar conversa" onClick={()=>{lookup.clear();setTurns([]);setRequest(null);setInput('');setNotice('')}}><Trash2 size={17}/></button>}
      <details className="chat-settings"><summary className="iconbtn" aria-label="Opções da conversa" title="Opções da conversa"><Settings2 size={17}/></summary><div className="panel stack"><small>Armazenamento neste dispositivo</small>
        {state.kind!=='guides'&&<button className="btn" disabled={answering} onClick={onlyGuides}>Usar só os guias</button>}
        <button type="button" className="textbtn" disabled={answering||state.kind==='loading'||removing} onClick={removeModel}>{removing?'Removendo…':'Apagar apenas o modelo em cache'}</button></div></details></div></header>
      <div ref={log} className="chat-log" role="log" aria-label="Mensagens" aria-live="polite" aria-relevant="additions text">
        {!turns.length&&<div className="chat-welcome"><span className="assistant-orb"><BookOpen size={28}/></span><h2>O que você quer conferir?</h2><p>Indique o tributo ou o documento e, se fizer diferença, o ano da operação.</p><div className="suggestions">{starters.map(a=><button key={a.id} onClick={()=>ask(a.question)}>{a.question}</button>)}</div></div>}
        {turns.map(({id,question,reply,research,vote:rating})=>{
          const pending=request?.id===id && (state.kind==='loading'||answering);
          const awaitingEvidence=research?.kind==='pending' && !reply.sources.length;
          return <Fragment key={id}><div className="bubble user"><small>Você</small><p>{question}</p></div><div className="bubble agent"><small>e-Leão · {awaitingEvidence?'Assistente fiscal':reply.mode}</small>
            {!awaitingEvidence&&<p>{pending&&!reply.sources.length&&!request?.hits?'Ainda não encontrei um guia na busca por palavras.':reply.text}</p>}
            {reply.sources.length>0&&<span className="source-caption">{reply.mode==='IA local'?'Fontes consultadas':'Fonte do guia'}</span>}
            {reply.sources.map((a,i)=><div className="bubble-foot" key={a.id}><a href={safeUrl(a.source)} target="_blank" rel="noreferrer"><BookOpen size={14}/>{a.question}<ExternalLink size={12}/></a>
              {i===0&&knowledge.includes(a)&&<div><button aria-label="Guia útil" aria-pressed={rating===true} className="iconbtn" onClick={()=>vote(id,a.id,true)}><ThumbsUp size={14}/></button><button aria-label="Guia pouco útil" aria-pressed={rating===false} className="iconbtn" onClick={()=>vote(id,a.id,false)}><ThumbsDown size={14}/></button></div>}</div>)}
            {research && <ResearchSources result={research} cited={reply.cited} excerptOnly={reply.mode==='Trecho da pesquisa'}/>}
            {pending&&<span className="reply-progress" role="status"><LoaderCircle size={13} className="spin"/>{state.kind==='loading'?'Aguardando a IA para explicar a pergunta mais recente…':!reply.sources.length&&!request?.hits?'A IA está procurando uma fonte revisada…':stage==='writing'?'A IA está redigindo a explicação…':'A IA está lendo as fontes…'}{answering&&<button className="textbtn" onClick={()=>interrupt('Explicação interrompida. As fontes disponíveis continuam na conversa.')}>Cancelar explicação</button>}</span>}
          </div></Fragment>;
        })}
      </div><div className="composer"><form onSubmit={e=>{e.preventDefault();ask(input)}}><input aria-label="Sua pergunta" placeholder="Pergunte sobre IBS, CBS ou NFS-e…" required maxLength={1000} value={input} onChange={e=>setInput(e.target.value)}/><button className="btn primary" aria-label="Enviar pergunta" disabled={!input.trim()}><Send size={17}/></button></form></div>
    </section><p className="privacy-foot"><ShieldCheck size={15}/> A conversa não é salva. A IA envia só termos fiscais nas consultas oficiais. Não inclua dados pessoais. Confira a vigência das fontes. Não é parecer fiscal.</p></>;
}
