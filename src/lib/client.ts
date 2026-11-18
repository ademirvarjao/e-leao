import {createClient} from '@supabase/supabase-js';
// Publishable project identity, never an admin credential. Authorization is enforced by RLS.
export const databaseUrl=import.meta.env?.VITE_SUPABASE_URL||'https://zfmmcnuyegrjmeurbgbl.supabase.co';
const publicKey=import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_HVfAWqSYzKHn6BAzRdKspg_sHrMLQin';
export const db=createClient(databaseUrl,publicKey,{auth:{storageKey:'eleao-auth-v2',flowType:'pkce'}});
export const redirectTo=()=>new URL(location.pathname,location.origin).href;
export async function gateway(action:string,payload:unknown){const {data,error}=await db.functions.invoke('eleao-api',{body:{action,payload}});if(error){let msg='Não foi possível acessar a integração. Verifique sua conexão e a configuração do serviço.';try{const body=await error.context.json();msg=body.error||msg}catch{/* Unavailable network/host */}throw Error(msg)}return data}
export {friendly} from './messages';
