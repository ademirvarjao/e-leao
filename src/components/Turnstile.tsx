import {useEffect,useRef,useState} from 'react';

type TurnstileAPI={render:(element:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void};
declare global {interface Window {turnstile?:TurnstileAPI}}
let loader:Promise<TurnstileAPI>|undefined;
function loadTurnstile():Promise<TurnstileAPI>{
 if(window.turnstile)return Promise.resolve(window.turnstile);
 if(loader)return loader;
 loader=new Promise<TurnstileAPI>((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;
  script.onload=()=>window.turnstile?resolve(window.turnstile):reject(Error('Verificação indisponível.'));
  script.onerror=()=>reject(Error('Não foi possível carregar a verificação.'));
  document.head.appendChild(script);
 }).catch(error=>{loader=undefined;throw error});
 return loader;
}
export default function Turnstile({siteKey,onToken}:{siteKey:string;onToken:(value:string)=>void}){
 const container=useRef<HTMLDivElement>(null),[error,setError]=useState('');
 useEffect(()=>{let mounted=true,id:string|undefined,api:TurnstileAPI|undefined;
  onToken('');
  loadTurnstile().then(instance=>{if(!mounted||!container.current)return;api=instance;id=api.render(container.current,{sitekey:siteKey,action:'solicitar_acesso',language:'pt-br',callback:(token:string)=>{if(mounted){setError('');onToken(token)}},'expired-callback':()=>{if(mounted){onToken('');setError('A verificação expirou. Refaça o desafio.')}},'error-callback':()=>{if(mounted){onToken('');setError('Não foi possível concluir a verificação. Recarregue a página e tente novamente.')}}})}).catch(()=>{if(mounted)setError('Não foi possível carregar a verificação. Confira sua conexão e recarregue a página.')});
  return()=>{mounted=false;if(api&&id)api.remove(id)};
 },[siteKey,onToken]);
 return <div><div ref={container}/>{error&&<p role="alert" className="fineprint">{error}</p>}</div>;
}
