import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {Session} from '@supabase/supabase-js';
import {db,friendly} from './client';
import {demoOperations,demoPeriod,sortOps} from './demo';
import {articles} from './knowledge';
import {today} from './fiscal';
import type {Article,Operation,Profile} from './types';
export type AuthMode='login'|'signup'|'reset'|'password';
type Workspace={session:Session|null;profile:Profile|null;operations:Operation[];knowledge:Article[];loading:boolean;error:string;period:string;setPeriod:(s:string)=>void;reload:()=>void;save:(o:Operation,edit?:boolean)=>Promise<void>;remove:(o:Operation)=>Promise<void>;notify:(s:string)=>void;message:string;authMode:AuthMode|null;auth:(m:AuthMode|null)=>void;feedback:(article:string,helpful:boolean)=>Promise<void>};
const Ctx=createContext<Workspace|null>(null);
export const useSpace=()=>useContext(Ctx)!;
const demoKey='eleao-demo-v1';
function loadDemo(){try{const x=JSON.parse(sessionStorage.getItem(demoKey)||'null');if(Array.isArray(x))return sortOps(x)}catch{/* Storage disabled. */}return demoOperations()}
export async function listRows<T>(table:string,fields='*',owner?:string):Promise<T[]>{const rows:T[]=[];for(let from=0;;from+=500){let q=db.from(table).select(fields).order('id').range(from,from+499);if(owner)q=q.eq('owner_id',owner);const {data,error}=await q;if(error)throw error;rows.push(...data as unknown as T[]);if(data.length<500)return rows}}
export function WorkspaceProvider({children}:{children:ReactNode}){const [session,setSession]=useState<Session|null>(null),[authMode,auth]=useState<AuthMode|null>(null);
 useEffect(()=>{const {data}=db.auth.onAuthStateChange((event,s)=>{setSession(s);if(event==='PASSWORD_RECOVERY')auth('password');else if(event==='SIGNED_IN')auth(v=>v==='password'?v:null)});return ()=>data.subscription.unsubscribe()},[]);
 return <WorkspaceData key={session?.user.id||'demo'} session={session} auth={auth} authMode={authMode}>{children}</WorkspaceData>}
function WorkspaceData({session,authMode,auth,children}:{session:Session|null;authMode:AuthMode|null;auth:(m:AuthMode|null)=>void;children:ReactNode}){
 const [operations,setOps]=useState<Operation[]>(()=>session?[]:loadDemo()),[knowledge,setKnowledge]=useState<Article[]>(session?[]:articles),[profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(!!session),[error,setError]=useState(''),[version,setVersion]=useState(0),[message,setMessage]=useState(''),[period,setPeriod]=useState(session?today().slice(0,7):demoPeriod);const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const notify=useCallback((s:string)=>{clearTimeout(timer.current);setMessage(s);timer.current=setTimeout(()=>setMessage(''),5000)},[]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);const uid=session?.user.id;
 useEffect(()=>{if(!uid)return;let alive=true;setLoading(true);setError('');(async()=>{const join=await db.rpc('eleao_join');if(join.error)throw join.error;const claim=await db.rpc('eleao_claim_owner');if(claim.error)throw claim.error;const p=await db.from('eleao_profiles').select('*').eq('id',uid).single();if(p.error)throw p.error;if(!p.data.active)throw Error('O acesso a este espaço está suspenso. Entre em contato com o administrador.');const [ops,docs]=await Promise.all([listRows<Operation>('eleao_operations','*',uid),listRows<Article>('eleao_articles')]);if(alive){setProfile(p.data as Profile);setOps(sortOps(ops));setKnowledge(docs)}})().catch(e=>{if(alive){setError(friendly(e));setOps([]);setProfile(null);setKnowledge([])}}).finally(()=>{if(alive)setLoading(false)});return ()=>{alive=false}},[uid,version]);
 useEffect(()=>{if(!uid){try{sessionStorage.setItem(demoKey,JSON.stringify(operations))}catch{/* Volatile demo remains usable. */}}},[operations,uid]);
 async function save(o:Operation,edit=false){if(!o.title.trim())throw Error('Informe um título para a operação.');let saved=o;if(uid){const {owner_id:_owner,created_at:_time,id,kind,...rest}=o;const q=edit?db.from('eleao_operations').update(rest).eq('id',id):db.from('eleao_operations').insert({id,kind,...rest});const {data,error}=await q.select().single();if(error)throw error;saved=data}setOps(v=>sortOps([saved,...v.filter(r=>r.id!==saved.id)]));setPeriod(saved.on_date.slice(0,7));}
 async function remove(o:Operation){if(uid){const {error}=await db.from('eleao_operations').delete().eq('id',o.id).select('id').single();if(error)throw error}setOps(v=>v.filter(r=>r.id!==o.id))}
 async function feedback(article_id:string,helpful:boolean){if(!uid){notify('Avaliação registrada nesta conversa de demonstração.');return}const {error}=await db.from('eleao_feedback').upsert({article_id,helpful},{onConflict:'owner_id,article_id'});if(error)throw error;notify('Avaliação enviada à curadoria. Obrigado!')}
 return <Ctx.Provider value={{session,auth,authMode,profile,operations,knowledge,loading,error,message,notify,period,setPeriod,reload:()=>setVersion(v=>v+1),save,remove,feedback}}>{children}</Ctx.Provider>}
