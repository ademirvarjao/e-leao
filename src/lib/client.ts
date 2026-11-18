import type {Engine} from './rtc';
import {integrationMessages} from './messages';
import {createClient} from '@supabase/supabase-js';
// Publishable project identity, never an admin credential. Authorization is enforced by RLS.
export const databaseUrl=import.meta.env?.VITE_SUPABASE_URL||'https://zfmmcnuyegrjmeurbgbl.supabase.co';
const publicKey=import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_HVfAWqSYzKHn6BAzRdKspg_sHrMLQin';
export const db=createClient(databaseUrl,publicKey,{auth:{storageKey:'eleao-auth-v2',flowType:'pkce'}});
export const redirectTo=()=>new URL(location.pathname,location.origin).href;
async function invokeFiscal(action: Engine | 'danfse', payload: unknown) {
  const {data,error,response} = await db.functions.invoke<unknown>('eleao-api', {body:{action,payload}, timeout:20000});
  if (error || !response) {
    const status = response?.status;
    throw Error(status === 401 ? integrationMessages.session : status === 403 ? integrationMessages.access :
      status === 429 ? integrationMessages.quota : status === 400 || status === 422 ? integrationMessages.input :
      status === 504 ? integrationMessages.timeout : integrationMessages.unavailable);
  }
  return {data,response};
}
export async function queryRTC(engine: Engine, payload: unknown) {
  const {data,response} = await invokeFiscal(engine,payload);
  if (!data || typeof data !== 'object' || Array.isArray(data) || data instanceof Blob) throw Error(integrationMessages.invalid);
  // The Edge Function returns the motor JSON directly, not an envelope with a `body` field.
  return {body:data as Record<string,unknown>, status:response.status, warning:response.headers.get('x-warning-dados-simulados')};
}
export async function renderDanfse(payload: {xml:string; stc:number; canhoto:boolean}) {
  const {data} = await invokeFiscal('danfse',payload);
  if (!(data instanceof Blob) || data.type !== 'application/pdf' || await data.slice(0,5).text() !== '%PDF-') throw Error('O gerador não retornou um PDF.');
  return data;
}
export {friendly} from './messages';
