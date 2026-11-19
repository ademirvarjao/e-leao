import {validTerms} from '../_shared/research.ts';
import {research} from './research.ts';

// Authenticated gateway. Origins, routes and tokens for the fiscal services are server-owned.
function cors(request: Request): Record<string,string> {
  const origin=request.headers.get('origin');
  if (!origin) return {vary:'Origin'};
  let allowed=['https://ademirvarjao.github.io','http://localhost:5173','http://localhost:3000'].includes(origin);
  try {const u=new URL(origin); allowed ||= u.protocol==='https:' && /^\d+-[a-z0-9-]+\.e2b\.app$/.test(u.hostname)} catch { /* Do not reflect unknown origins. */ }
  return allowed ? {'access-control-allow-origin':origin,'access-control-allow-headers':'authorization, apikey, content-type, x-client-info','access-control-allow-methods':'POST, OPTIONS','access-control-expose-headers':'x-warning-dados-simulados',vary:'Origin'} : {vary:'Origin'};
}
function reply(request:Request, body:unknown, status=200) {
  return Response.json(body,{status,headers:{...cors(request),'cache-control':'no-store'}});
}
class Problem extends Error {
  constructor(readonly status:number, message:string, readonly code?:string) {super(message)}
}
const routes={
  regular:{env:'RTC_REGULAR_URL',post:'/api/calculadora/observabilidade/regime-geral',check:'/api/calculadora/dados-abertos/versao'},
  simple:{env:'RTC_SIMPLE_URL',post:'/api/calculadora/observabilidade/simples-nacional',check:'/api/versao'},
  base:{env:'RTC_BASE_URL',post:'/api/calculadora/base-calculo/base-calculo-unificada-nfse',check:'/api/calculadora/dados-abertos/versao'},
  danfse:{env:'RTC_DANFSE_URL',post:'/api/danfse',check:'/health/ready'},
} as const;
type Service=keyof typeof routes;
const isService=(s:unknown):s is Service=>typeof s==='string' && Object.hasOwn(routes,s);
const invalidResponse=()=>new Problem(502,'Resposta incompatível com o serviço fiscal.','RTC_INVALID_RESPONSE');
function endpoint(service:Service, check:boolean) {
  // The regular application also implements the NFS-e base endpoint. An explicit override wins.
  const route=routes[service], base=Deno.env.get(route.env)?.trim() || (service==='base'?Deno.env.get(routes.regular.env)?.trim():undefined);
  if (!base) throw new Problem(503,'O administrador ainda não conectou este serviço fiscal.','RTC_NOT_CONFIGURED');
  let target:URL;
  try {
    target=new URL(base);
    if (target.protocol!=='https:' || target.username || target.password || target.search || target.hash || /(^|\.)(github\.com|githubusercontent\.com|github\.io)$/.test(target.hostname.replace(/\.$/,''))) throw Error();
  } catch {throw new Problem(503,'O endereço configurado não é uma base HTTPS de serviço fiscal.','RTC_INVALID_CONFIG')}
  // A reverse proxy may mount the application under a path. Do not drop that prefix.
  target.pathname=target.pathname.replace(/\/+$/,'').replace(/\/api$/,'')+route[check?'check':'post'];
  return target;
}
class TooLarge extends Error {}
async function bytes(message:Request|Response,limit:number) {
  if (Number(message.headers.get('content-length'))>limit) {await message.body?.cancel();throw new TooLarge()}
  const reader=message.body?.getReader(), chunks:Uint8Array[]=[];
  let length=0;
  if (reader) try {
    for (;;) {
      const {done,value}=await reader.read(); if(done) break;
      length+=value.byteLength; if(length>limit) {await reader.cancel();throw new TooLarge()}
      chunks.push(value);
    }
  } finally {reader.releaseLock()}
  const joined=new Uint8Array(length); let offset=0;
  for (const part of chunks) {joined.set(part,offset);offset+=part.byteLength}
  return joined;
}
const isObject=(x:unknown):x is Record<string,unknown>=>typeof x==='object' && x!==null && !Array.isArray(x);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const gatewayIssue=()=>new Problem(503,'Não foi possível validar o acesso ao gateway.','RTC_GATEWAY_UNAVAILABLE');
async function authenticate(request:Request) {
  const base=Deno.env.get('SUPABASE_URL'), apikey=Deno.env.get('SUPABASE_ANON_KEY');
  if (!base || !apikey) throw gatewayIssue();
  const authorization=request.headers.get('authorization')||'';
  if (!/^Bearer\s+\S{16,}$/i.test(authorization)) throw new Problem(401,'Entre na sua conta para usar esta integração.');
  const headers={apikey,authorization};
  try {
    const res=await fetch(`${base}/auth/v1/user`,{headers,signal:AbortSignal.timeout(3000)});
    if (res.status===401 || res.status===403) throw new Problem(401,'Sessão inválida. Entre novamente.');
    if (!res.ok) throw gatewayIssue();
    const user=await res.json();
    if (!UUID.test(user?.id||'') || !user.email_confirmed_at) throw new Problem(403,'Confirme o e-mail da conta antes de continuar.');
  } catch(e) {throw e instanceof Problem?e:gatewayIssue()}
  return async (charge:boolean|'research')=>{
    const rpc=charge==='research'?'eleao_take_research_quota':charge?'eleao_take_quota':'eleao_is_active';
    try {
      const res=await fetch(`${base}/rest/v1/rpc/${rpc}`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(7000)});
      if (!res.ok) throw gatewayIssue();
      if (await res.json()!==true) throw charge?new Problem(429,'Conta suspensa ou limite diário de 40 consultas atingido.'):new Problem(403,'Acesso restrito a contas ativas.');
    } catch(e) {throw e instanceof Problem?e:gatewayIssue()}
  };
}
function checkStatus(status:number, check:boolean) {
  if (status===400 || status===422) {if(!check) throw new Problem(status,'O motor rejeitou os campos informados.');throw invalidResponse()}
  if (status===401 || status===403) throw new Problem(502,'O serviço fiscal recusou o acesso do gateway.','RTC_UPSTREAM_AUTH');
  if (status===404 || status===405 || (status>=300 && status<400)) throw new Problem(502,'Verifique a rota e a versão do serviço configurado.','RTC_ROUTE');
  if (status===408 || status===504) throw new Problem(504,'Tempo limite do serviço fiscal.');
  if (status<200 || status>=300) throw new Problem(502,'O serviço fiscal não está disponível.','RTC_UPSTREAM_UNAVAILABLE');
}
const version=(v:unknown)=>typeof v==='string' && /^[\w][\w.+-]{0,79}$/.test(v)?v:undefined;
// The public read-only URL used by the Receita offline distribution itself (application-offline.yml).
// This is a pilot VERSION endpoint, never a default target for calculations or XML.
const publishedVersionUrl='https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/api/calculadora/dados-abertos/versao';
async function publishedVersion(request:Request) {
  try {
    const res=await fetch(publishedVersionUrl,{method:'GET',headers:{accept:'application/json'},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(5000)});
    if (!res.ok) {await res.body?.cancel();throw Error()}
    const data=JSON.parse(new TextDecoder().decode(await bytes(res,16_384)));
    const dbVersion=version(data?.versaoDb);
    if (!dbVersion) throw Error();
    return reply(request,{dbVersion});
  } catch {throw new Problem(502,'A versão da base não pôde ser lida no piloto da Receita.','RTC_REFERENCE_UNAVAILABLE')}
}
async function handle(request:Request) {
  const access=await authenticate(request);
  if (!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json')) throw new Problem(415,'O corpo precisa usar application/json.');
  let input:unknown;
  try {input=JSON.parse(new TextDecoder().decode(await bytes(request,1_500_000)))}
  catch(e) {throw new Problem(400,e instanceof TooLarge?'O corpo da solicitação excede o limite permitido.':'O corpo precisa ser JSON válido.')}
  if (!isObject(input) || !isObject(input.payload)) throw new Problem(400,'Formato de solicitação inválido.');
  const {action,payload}=input, check=action==='check-service', service=check?payload.service:action;
  if (action==='official-search') {
    if(Object.keys(input).length!==2 || Object.keys(payload).length!==1 || !validTerms(payload.terms)) throw new Problem(400,'Informe apenas termos fiscais públicos.');
    await access('research');
    try {return reply(request,await research(payload.terms,request.signal,bytes))}
    catch {throw new Problem(503,'As fontes oficiais não responderam à pesquisa.','SEARCH_UNAVAILABLE')}
  }
  if (action==='reference-version') {
    if (Object.keys(payload).length) throw new Problem(400,'A consulta de versão não recebe campos da operação.');
    await access(true);return publishedVersion(request);
  }
  if (action==='emit') throw new Problem(501,'Transmissão de NFS-e não implementada.');
  if (!isService(service) || (check && Object.keys(payload).length!==1)) throw new Problem(check?400:404,'Ação ou serviço não reconhecido.');
  let target:URL;
  try {target=endpoint(service,check)} catch(e) {await access(false);throw e} // No consumption when there's nowhere to send the request.
  const pdf=!check && service==='danfse';
  const headers=new Headers({accept:pdf?'application/pdf':'application/json'});
  let body:string|undefined;
  if (!check) {
    if (pdf) {
      const {xml,stc,canhoto}=payload;
      if (typeof xml!=='string' || xml.length>1_400_000 || !['0','1','2',0,1,2].some(v=>v===stc) || typeof canhoto!=='boolean' || /<!DOCTYPE/i.test(xml)) throw new Problem(400,'XML, situação ou opções da DANFSe inválidos.');
      target.searchParams.set('stc',String(stc));target.searchParams.set('canhoto',String(canhoto));
      headers.set('content-type','application/xml'); body=xml;
    } else {
      body=JSON.stringify(payload);if(body.length>65_000) throw new Problem(400,'O corpo da solicitação é muito extenso.');
      headers.set('content-type','application/json');
    }
  }
  await access(true); // Probes also contact the upstream; same per-account limit as calculations.
  const token=Deno.env.get(service==='danfse'?'DANFSE_API_TOKEN':'RTC_API_TOKEN');
  if(token) headers.set('authorization',`Bearer ${token}`);
  const res=await fetch(target,{method:check?'GET':'POST',headers,body,redirect:'manual',signal:AbortSignal.timeout(5000)});
  if (!res.ok) {await res.body?.cancel();checkStatus(res.status,check)}
  const data=await bytes(res,check?16_384:pdf?12_000_000:1_000_000);
  const responseHeaders:Record<string,string>={...cors(request),'cache-control':'no-store'};
  if (pdf) {
    if (res.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/pdf' || new TextDecoder().decode(data.subarray(0,5))!=='%PDF-') throw invalidResponse();
    return new Response(data,{headers:{...responseHeaders,'content-type':'application/pdf','content-disposition':'attachment; filename="danfse.pdf"'}});
  }
  let parsed:unknown;
  try {parsed=JSON.parse(new TextDecoder().decode(data))} catch {throw invalidResponse()}
  if (!isObject(parsed)) throw invalidResponse();
  if (check) {
    const appVersion=version(parsed.versaoApp), dbVersion=version(parsed.versaoDb);
    if (service==='danfse'?parsed.status!=='ok':!appVersion && !dbVersion) throw invalidResponse();
    return reply(request,{service,reachable:true,...(service==='danfse'?{}:{appVersion,dbVersion})});
  }
  const warning=res.headers.get('x-warning-dados-simulados');
  if(warning) responseHeaders['x-warning-dados-simulados']=/^\d{1,3}$/.test(warning)?warning:'true';
  return new Response(data,{status:res.status,headers:{...responseHeaders,'content-type':'application/json; charset=utf-8'}});
}
Deno.serve(async request=>{
  if(request.method==='OPTIONS') {const headers=cors(request);return new Response(null,{status:headers['access-control-allow-origin']?204:403,headers})}
  if(request.method!=='POST') return reply(request,{error:'Método não permitido.'},405);
  try {return await handle(request)} catch(e) {
    // Never expose URLs, tokens, upstream bodies, XML or exception details.
    let error:Problem;
    if (e instanceof Problem) error=e;
    else if (e instanceof TooLarge) error=invalidResponse();
    else if (e instanceof DOMException && ['TimeoutError','AbortError'].includes(e.name)) error=new Problem(504,'Tempo limite do serviço fiscal.');
    else error=new Problem(502,'O serviço fiscal não respondeu.','RTC_UPSTREAM_UNAVAILABLE');
    return reply(request,{error:error.message,code:error.code},error.status);
  }
});
