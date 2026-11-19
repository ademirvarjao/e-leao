import type {Engine,FiscalService} from './rtc';
import {integrationMessages} from './messages';
import {createClient} from '@supabase/supabase-js';
// Publishable project identity, never an admin credential. Authorization is enforced by RLS.
export const databaseUrl=import.meta.env?.VITE_SUPABASE_URL||'https://zfmmcnuyegrjmeurbgbl.supabase.co';
const publicKey=import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_HVfAWqSYzKHn6BAzRdKspg_sHrMLQin';
export const db=createClient(databaseUrl,publicKey,{auth:{storageKey:'eleao-auth-v2',flowType:'pkce'}});
export const redirectTo=()=>new URL(location.pathname,location.origin).href;
type FiscalAction = FiscalService | 'check-service' | 'reference-version';
async function fiscalFailure(action:FiscalAction, response?:Response) {
  if (!response) return integrationMessages.network;
  const status=response.status;
  if(status===401) return integrationMessages.session;
  if(status===403) return integrationMessages.access;
  if(status===429) return integrationMessages.quota;
  if(status===400 || status===422) return integrationMessages.input;
  if(status===504) return integrationMessages.timeout;
  // Only map known gateway codes. Don't display exception messages/HTML from a server.
  const body=await response.json().catch(()=>null);
  if(status===404 && (action==='check-service' || action==='reference-version') && body?.error==='Ação não reconhecida.') return integrationMessages.oldGateway;
  if(status===502 || status===503) {
    // The original (v3) Edge function in production returns this exact 502 without a code.
    if(body?.error==='Este serviço não está configurado pelo administrador. Consulte as instruções de implantação.') return integrationMessages.notConfigured;
    if(body?.error==='A integração deve usar HTTPS.') return integrationMessages.config;
    switch(body?.code) {
      case 'RTC_NOT_CONFIGURED':return integrationMessages.notConfigured;
      case 'RTC_INVALID_CONFIG':return integrationMessages.config;
      case 'RTC_GATEWAY_UNAVAILABLE':return integrationMessages.gateway;
      case 'RTC_UPSTREAM_AUTH':return integrationMessages.upstreamAuth;
      case 'RTC_REFERENCE_UNAVAILABLE':return integrationMessages.referenceUnavailable;
      case 'RTC_ROUTE':return integrationMessages.route;
      case 'RTC_UPSTREAM_UNAVAILABLE':return integrationMessages.upstream;
      case 'RTC_INVALID_RESPONSE':return integrationMessages.invalid;
    }
  }
  return integrationMessages.unavailable;
}
async function invokeFiscal(action:FiscalAction, payload:unknown) {
  const {data,error,response} = await db.functions.invoke<unknown>('eleao-api',{body:{action,payload}, timeout:20000});
  if(error || !response) throw Error(error instanceof SyntaxError?integrationMessages.invalid:await fiscalFailure(action,response));
  return {data,response};
}
const version=(v:unknown)=>typeof v==='string' && /^[\w][\w.+-]{0,79}$/.test(v)?v:undefined;
export async function checkPublishedDbVersion() {
  const {data}=await invokeFiscal('reference-version',{});
  const checked=data && typeof data==='object' && 'dbVersion' in data && version(data.dbVersion);
  if(!checked) throw Error(integrationMessages.invalid);
  return checked;
}
export async function checkFiscalService(service:FiscalService) {
  const {data}=await invokeFiscal('check-service',{service});
  if(!data || typeof data!=='object' || !('service' in data) || data.service!==service || !('reachable' in data) || data.reachable!==true) throw Error(integrationMessages.invalid);
  return {appVersion:version('appVersion' in data && data.appVersion),dbVersion:version('dbVersion' in data && data.dbVersion)};
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
