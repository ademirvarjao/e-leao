// This public endpoint must never accept a request without server-side Siteverify.
// Credentials and challenge tokens must not be logged.
export type RequestConfig={url:string;serviceKey:string;turnstileSecret:string};
const allowedOrigins=new Set(['https://ademirvarjao.github.io','http://localhost:5173','http://localhost:3000']);
const hostname='ademirvarjao.github.io';
const action='solicitar_acesso';
function responseHeaders(req:Request){const origin=req.headers.get('origin')||'';return {'content-type':'application/json','cache-control':'no-store','vary':'Origin',...(allowedOrigins.has(origin)?{'access-control-allow-origin':origin,'access-control-allow-headers':'authorization, apikey, content-type, x-client-info','access-control-allow-methods':'POST, OPTIONS'}:{})}}
export async function handleRequest(req:Request,config:RequestConfig,request:typeof fetch=fetch):Promise<Response>{
 const headers=responseHeaders(req);
 const reply=(status:number,error?:string)=>new Response(JSON.stringify(error?{error}:{ok:true}),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:headers['access-control-allow-origin']?204:403,headers});
 if(req.method!=='POST')return reply(405,'Método não permitido.');
 // Refuse the public dummy secrets, which always accept dummy responses.
 if(!config.url||!config.serviceKey||!config.turnstileSecret||/^[123]x0{20,}/.test(config.turnstileSecret))return reply(503,'Verificação de segurança indisponível.');
 let body:Record<string,unknown>;
 try{
  if(Number(req.headers.get('content-length')||0)>4096)return reply(413,'Solicitação muito grande.');
  const reader=req.body?.getReader();if(!reader)return reply(400,'Solicitação inválida.');let size=0;const chunks:Uint8Array[]=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return reply(413,'Solicitação muito grande.')}chunks.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}body=JSON.parse(new TextDecoder().decode(bytes));
 }catch{return reply(400,'Solicitação inválida.')}
 if(!body||typeof body.name!=='string'||body.name.length>80||typeof body.email!=='string'||body.email.length>254||typeof body.token!=='string'||!body.token||body.token.length>2048||typeof body.issued_at!=='number'||!Number.isSafeInteger(body.issued_at)||typeof body.nonce!=='string'||!/^[0-9a-f]{16}$/.test(body.nonce))return reply(400,'Solicitação inválida.');
 try{
  const verify=await request('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({secret:config.turnstileSecret,response:body.token}),signal:AbortSignal.timeout(10000)});
  if(!verify.ok)return reply(503,'Verificação de segurança indisponível. Tente novamente.');
  const result=await verify.json();
  if(result.success!==true||result.hostname!==hostname||result.action!==action)return reply(400,'Verificação de segurança inválida ou expirada. Tente novamente.');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.token))),x=>x.toString(16).padStart(2,'0')).join('');
  const saved=await request(`${config.url}/rest/v1/rpc/eleao_request_access_verified`,{method:'POST',headers:{'content-type':'application/json',apikey:config.serviceKey,authorization:`Bearer ${config.serviceKey}`},body:JSON.stringify({request_name:body.name,request_email:body.email,issued_at:body.issued_at,nonce:body.nonce,token_digest:digest}),signal:AbortSignal.timeout(10000)});
  if(!saved.ok)return reply(400,'Não foi possível registrar a solicitação. Tente novamente mais tarde.');
  return reply(200);
 }catch{return reply(503,'Verificação de segurança indisponível. Tente novamente.')}
}
