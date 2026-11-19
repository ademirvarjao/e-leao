import {useCallback,useEffect,useRef,useState} from 'react';
import type {LocalModel,ModelLoader} from './assistant';

const preference = 'eleao-assistente-so-guias';
const guidesOnly = () => {try {return window.localStorage.getItem(preference)==='true'} catch {return false}};
function rememberGuides(only:boolean) {
  try {if(only) window.localStorage.setItem(preference,'true'); else window.localStorage.removeItem(preference)} catch { /* Preference applies to this visit if storage is blocked. */ }
}
const openModel: ModelLoader = async (...args) => (await import('./localModel')).loadLocalModel(...args);
type State = {kind:'loading'; percent:number} | {kind:'ready'; engine:LocalModel} | {kind:'guides'} | {kind:'error'; message:string};
function loadError(e:unknown) {
  if(e instanceof Error && (e.message==='storage'||e.name==='QuotaExceededError')) return 'Não há espaço disponível para o modelo. Libere ao menos 400 MB de armazenamento para o site ou continue nos guias.';
  if(e instanceof Error && e.message==='unsupported') return 'Este navegador não oferece os recursos para IA local. Use um navegador atualizado, em HTTPS, ou consulte os guias.';
  return 'Não foi possível preparar a IA. Confira a conexão, o espaço livre e as permissões do navegador. Os guias continuam disponíveis.';
}

// Scoped to a visit to the private assistant, never to the landing page or dashboard.
export function useDeviceModel(load:ModelLoader=openModel) {
  const [state,setState] = useState<State>(()=>guidesOnly()?{kind:'guides'}:{kind:'loading',percent:0});
  const engine = useRef<LocalModel|null>(null);
  const loading = useRef<{ctrl:AbortController; timer:ReturnType<typeof setTimeout>}|null>(null);
  const dispose = useCallback(()=>{
    const job=loading.current; loading.current=null;
    if(job){clearTimeout(job.timer);job.ctrl.abort()}
    engine.current?.close();engine.current=null;
  },[]);
  const prepare = useCallback(async()=>{
    if(loading.current||engine.current)return;
    const ctrl=new AbortController();
    const timer=setTimeout(()=>{
      if(ctrl.signal.aborted)return;
      dispose();setState({kind:'error',message:'O modelo não ficou pronto a tempo. Você pode continuar pelos guias ou tentar carregar novamente.'});
    },600_000);
    loading.current={ctrl,timer};setState({kind:'loading',percent:0});
    let last=0;
    try {
      const acquired=await load(ctrl.signal,percent=>{
        if(loading.current?.ctrl===ctrl && !ctrl.signal.aborted && percent!==last){last=percent;setState({kind:'loading',percent})}
      });
      if(ctrl.signal.aborted){acquired.close();return}
      engine.current=acquired;setState({kind:'ready',engine:acquired});
    } catch(e) {
      if(!ctrl.signal.aborted)setState({kind:'error',message:loadError(e)});
    } finally {clearTimeout(timer);if(loading.current?.ctrl===ctrl)loading.current=null}
  },[load,dispose]);
  useEffect(()=>{
    let here=true;
    // React StrictMode replays effects. Don't start two downloads or two workers.
    queueMicrotask(()=>{if(here&&!guidesOnly())void prepare()});
    return ()=>{here=false;dispose()};
  },[prepare,dispose]);
  const retry = useCallback(()=>{rememberGuides(false);void prepare()},[prepare]);
  const pause = useCallback(()=>{rememberGuides(true);dispose();setState({kind:'guides'})},[dispose]);
  // A stuck worker must not hold the only inference slot. Reopen the cached model
  // for the NEXT question. Never resubmit the failed/cancelled generation in a loop.
  const recover = useCallback(()=>{dispose();void prepare()},[dispose,prepare]);
  return {state,retry,pause,recover};
}
