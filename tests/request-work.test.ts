import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

test('prova obrigatória, vinculada à solicitação, recente e de uso único',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});
 try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin; create schema auth; create schema extensions; create extension pgcrypto with schema extensions; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb); create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for(const file of ['20261118000100_eleao_workspace.sql','20261118000300_eleao_owner_claim.sql','20261118000400_access_approval.sql','20261118000600_manual_invites.sql','20261118000700_request_rate_safety.sql','20261118001000_request_work.sql','20261118001100_enforce_request_work.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const name='Teste',email='teste@example.test',time=Math.floor(Date.now()/1000);let i=0,nonce='';
  do {nonce=(i++).toString(16).padStart(16,'0')} while(!createHash('sha256').update(`${name}\n${email}\n${time}\n${nonce}`).digest('hex').startsWith('0000'));
  const as=async(role:string,sql:string,args:unknown[]=[])=>{await db.exec('begin');try{await db.exec(`set local role ${role}`);const result=await db.query(sql,args);await db.exec('commit');return result}catch(e){await db.exec('rollback');throw e}};
  const call='select public.eleao_request_access_pow($1,$2,$3,$4)';
  for(const role of ['anon','authenticated']) await assert.rejects(()=>as(role,"select public.eleao_request_access('Teste','outro@example.test')"),/permission denied/);
  await assert.rejects(()=>as('anon',call,[name,'alterado@example.test',time,nonce]),/segurança inválida/);
  await assert.rejects(()=>as('anon',call,[name,email,time-600,nonce]),/expirada/);
  await assert.rejects(()=>as('anon',call,[name,email,time,null]),/inválida/);
  await as('anon',call,[name,email,time,nonce]);
  await assert.rejects(()=>as('anon',call,[name,email,time,nonce]),/já utilizada/);
  assert.equal((await db.query('select count(*)::int n from public.eleao_access_requests')).rows[0].n,1);
  await assert.rejects(()=>as('anon','select * from public.eleao_request_proofs'),/permission denied/);
 } finally {await db.close()}
});
