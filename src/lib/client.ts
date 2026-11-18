import {createClient} from '@supabase/supabase-js';
// Publishable project identity, never an admin credential. Authorization is enforced by RLS.
export const databaseUrl=import.meta.env.VITE_SUPABASE_URL||'https://byqhiewzkbqvvmldnwky.supabase.co';
const publicKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_uY6cKI7trjY285UPVRCYjg_ANdtK5t5';
export const db=createClient(databaseUrl,publicKey,{auth:{storageKey:'eleao-auth-v1',flowType:'pkce'}});
export const redirectTo=()=>new URL(location.pathname,location.origin).href;
export async function gateway(action:string,payload:unknown){const {data,error}=await db.functions.invoke('eleao-api',{body:{action,payload}});if(error){let msg='Não foi possível acessar a integração. Verifique sua conexão e a configuração do serviço.';try{const body=await error.context.json();msg=body.error||msg}catch{/* Unavailable network/host */}throw Error(msg)}return data}
export const friendly=(e:unknown)=>{const raw=e instanceof Error?e.message:String((e as {message?:string})?.message||e);if(/invalid login credentials/i.test(raw))return 'E-mail ou senha incorretos.';if(/email not confirmed/i.test(raw))return 'Confirme seu e-mail antes de entrar.';if(/rate limit/i.test(raw))return 'Muitas tentativas. Aguarde alguns minutos.';if(/fetch|network|load failed|timeout/i.test(raw))return 'Não foi possível conectar ao serviço. Verifique a conexão e tente novamente.';return raw;};
