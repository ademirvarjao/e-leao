// Public endpoint: only a valid, single-use, owner-issued secret can reset an active member password.
// Never log the request or credentials. JWT verification must be disabled for this function.
const origins = new Set(['https://ademirvarjao.github.io','http://localhost:5173','http://localhost:3000']);
function headers(req:Request){const origin=req.headers.get('origin')||'';let allowed=origins.has(origin);try{const u=new URL(origin);allowed ||= u.protocol==='https:'&&/^\d+-[a-z0-9-]+\.e2b\.app$/.test(u.hostname)}catch{/* no browser origin */}return {'content-type':'application/json','cache-control':'no-store','vary':'Origin',...(allowed?{'access-control-allow-origin':origin,'access-control-allow-headers':'authorization, apikey, content-type, x-client-info','access-control-allow-methods':'POST, OPTIONS'}:{})}}
Deno.serve(async req=>{
 const h=headers(req);const answer=(status:number,error?:string)=>new Response(JSON.stringify(error?{error}:{ok:true}),{status,headers:h});
 if(req.method==='OPTIONS')return new Response(null,{status:h['access-control-allow-origin']?204:403,headers:h});
 if(req.method!=='POST')return answer(405,'Método não permitido.');
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)return answer(503,'Serviço não configurado.');
 let body;try{const length=Number(req.headers.get('content-length')||0);if(length>4096)return answer(413,'Solicitação muito grande.');const reader=req.body?.getReader();if(!reader)return answer(400,'Solicitação inválida.');let n=0;const chunks:Uint8Array[]=[];try{for(;;){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>4096){await reader.cancel();return answer(413,'Solicitação muito grande.')}chunks.push(value)}}finally{reader.releaseLock()}const bytes=new Uint8Array(n);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}body=JSON.parse(new TextDecoder().decode(bytes))}catch{return answer(400,'Solicitação inválida.')}
 if(!body||typeof body.token!=='string'||!/^[0-9a-f]{64}$/.test(body.token)||typeof body.password!=='string'||body.password.length<10||body.password.length>128)return answer(400,'Convite ou senha inválidos.');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.token))),b=>b.toString(16).padStart(2,'0')).join('');
 const opts={apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'};
 try{
  const reserve=await fetch(`${url}/rest/v1/rpc/eleao_reserve_password_reset`,{method:'POST',headers:opts,body:JSON.stringify({hash_value:digest})});if(!reserve.ok)return answer(503,'Não foi possível validar o convite.');const records=await reserve.json();if(records.length!==1)return answer(400,'Link inválido, usado ou expirado. Solicite outro ao administrador.');
  const r=records[0];const changed=await fetch(`${url}/auth/v1/admin/users/${r.member_id}`,{method:'PUT',headers:opts,body:JSON.stringify({password:body.password})});
  if(!changed.ok)return answer(503,'Não foi possível alterar a senha. Contate o administrador.');
  const finish=await fetch(`${url}/rest/v1/rpc/eleao_finish_password_reset`,{method:'POST',headers:opts,body:JSON.stringify({reset_id:r.reset_id,member_id:r.member_id})});
  if(!finish.ok)return answer(503,'Senha alterada, mas sessões antigas não puderam ser revogadas. Contate o administrador imediatamente.');return answer(200);
 }catch{return answer(503,'Serviço indisponível. Contate o administrador para análise do convite.')}
});
