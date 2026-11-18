import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {handleRequest} from '../supabase/functions/eleao-request/handler';

test('endpoint exige Siteverify válido, ação e hostname corretos',async()=>{
 const config={url:'https://example.invalid',serviceKey:'service-key',turnstileSecret:'production-secret'};
 const payload={name:'Pessoa',email:'pessoa@example.test',token:'challenge-token',issued_at:1,nonce:'0000000000000000'};
 const req=()=>new Request('https://example.invalid',{method:'POST',headers:{origin:'https://ademirvarjao.github.io','content-type':'application/json'},body:JSON.stringify(payload)});
 let calls:string[]=[];
 const mock=(result:object,status=200):typeof fetch=>async (input,init)=>{const url=String(input);calls.push(url);if(url.includes('siteverify'))return new Response(JSON.stringify(result),{status});assert.equal((init?.headers as Record<string,string>).authorization,'Bearer service-key');const sent=JSON.parse(String(init?.body));assert.equal(sent.token_digest,createHash('sha256').update(payload.token).digest('hex'));return new Response(null,{status:204})};
 for(const result of [{success:false},{success:true,hostname:'evil.test',action:'solicitar_acesso'},{success:true,hostname:'ademirvarjao.github.io',action:'wrong'}]){calls=[];assert.equal((await handleRequest(req(),config,mock(result))).status,400);assert.equal(calls.length,1)}
 calls=[];assert.equal((await handleRequest(req(),config,mock({success:true,hostname:'ademirvarjao.github.io',action:'solicitar_acesso'}))).status,200);assert.equal(calls.length,2);
 calls=[];assert.equal((await handleRequest(req(),{...config,turnstileSecret:'1x0000000000000000000000000000000AA'},mock({success:true}))).status,503);assert.equal(calls.length,0);
 calls=[];assert.equal((await handleRequest(req(),config,mock({},500))).status,503);assert.equal(calls.length,1);
 const noToken=new Request('https://example.invalid',{method:'POST',body:JSON.stringify({...payload,token:''})});assert.equal((await handleRequest(noToken,config,mock({}))).status,400);
 const huge=new Request('https://example.invalid',{method:'POST',body:'x'.repeat(4097)});assert.equal((await handleRequest(huge,config,mock({}))).status,413);
});

test('cutover protege API e token Turnstile contra reuso',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});try{
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin; create schema auth; create schema extensions; create extension pgcrypto with schema extensions; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb); create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for(const file of ['20261118000100_eleao_workspace.sql','20261118000300_eleao_owner_claim.sql','20261118000400_access_approval.sql','20261118000600_manual_invites.sql','20261118000700_request_rate_safety.sql','20261118001000_request_work.sql','20261118001100_enforce_request_work.sql','20261118001200_turnstile_verified.sql','20261118001300_turnstile_enforcement.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const role=async(r:string,q:string,args:unknown[]=[])=>{await db.exec('begin');try{await db.exec(`set local role ${r}`);let value=await db.query(q,args);await db.exec('commit');return value}catch(e){await db.exec('rollback');throw e}};
  let time=Math.floor(Date.now()/1000),i=0,nonce='';const name='Teste',email='turnstile@example.test';do{nonce=(i++).toString(16).padStart(16,'0')}while(!createHash('sha256').update(`${name}\n${email}\n${time}\n${nonce}`).digest('hex').startsWith('0000'));
  const pow='select public.eleao_request_access_pow($1,$2,$3,$4)', verified='select public.eleao_request_access_verified($1,$2,$3,$4,$5)', args=[name,email,time,nonce,'a'.repeat(64)];
  for(const r of ['anon','authenticated']){await assert.rejects(()=>role(r,pow,args.slice(0,4)),/permission denied/);await assert.rejects(()=>role(r,verified,args),/permission denied/)}
  await role('service_role',verified,args);
  await assert.rejects(()=>role('service_role',verified,args),/já utilizada/);
  assert.equal((await db.query('select count(*)::int n from public.eleao_access_requests')).rows[0].n,1);
 }finally{await db.close()}
});
