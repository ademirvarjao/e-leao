import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('solicitação confirmada fica pendente e só o proprietário pode aprovar',async()=>{const sql=new PGlite();try{
 await sql.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb); create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 for(const name of ['20261118000100_eleao_workspace.sql','20261118000300_eleao_owner_claim.sql','20261118000400_access_approval.sql','20261118001500_research_quota.sql','20261118001600_research_approved.sql'])await sql.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 const owner='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',member='cccccccc-cccc-4ccc-8ccc-cccccccccccc',other='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 await sql.query(`insert into auth.users(id,email,email_confirmed_at) values($1,'ademirvarjao@gmail.com',now()),($2,'c@exemplo.test',null),($3,'outro@exemplo.test',now())`,[owner,member,other]);
 const as=async(id:string,q:string,params:unknown[]=[])=>{await sql.exec('begin');try{await sql.exec('set local role authenticated');await sql.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);const result=await sql.query(q,params);await sql.exec('commit');return result}catch(e){await sql.exec('rollback');throw e}};
 await as(owner,'select public.eleao_claim_owner()');await sql.query('update auth.users set email_confirmed_at=now() where id=$1',[member]);
 assert.equal((await as(member,'select public.eleao_is_active() as ok')).rows[0].ok,false);
 await assert.rejects(()=>as(member,"insert into public.eleao_operations(kind,title,on_date,regime,base_cents) values('simulation','Teste','2026-11-18','Regime regular',100)"));
 assert.equal((await sql.query('select approval_status from public.eleao_profiles where id=$1',[member])).rows[0].approval_status,'pending');
 await assert.rejects(()=>as(member,'select public.eleao_review_request($1,true)',[member]));
 await sql.query("update public.eleao_profiles set role='admin',active=true where id=$1",[other]);
 await assert.rejects(()=>as(other,'select public.eleao_review_request($1,true)',[member]));
 await assert.rejects(()=>as(other,'select public.eleao_set_active($1,true)',[member]));
 assert.equal((await as(owner,'select * from public.eleao_pending_requests()')).rows.length,1);
 await as(owner,'select public.eleao_review_request($1,true)',[member]);
 assert.equal((await as(member,'select public.eleao_is_active() as ok')).rows[0].ok,true);
 await assert.rejects(()=>as(owner,'select public.eleao_review_request($1,true)',[member]));
 // Even an inconsistent active + pending profile cannot charge the search tool.
 const charge='select public.eleao_take_research_quota() as ok';
 assert.equal((await as(other,charge)).rows[0].ok,false);
 await as(owner,'select public.eleao_set_active($1,false)',[member]);
 assert.equal((await as(member,charge)).rows[0].ok,false);
 await as(owner,'select public.eleao_set_active($1,true)',[member]);
 assert.equal((await as(member,'select count(*)::int as n from generate_series(1,41) where eleao_take_research_quota()')).rows[0].n,40);
 assert.equal((await as(member,charge)).rows[0].ok,false);
 assert.equal((await as(member,'select eleao_take_quota() as ok')).rows[0].ok,true); // independent RTC allowance
 await assert.rejects(()=>as(member,'select * from eleao_research_usage'));
 assert.equal((await sql.query("select has_function_privilege('anon','public.eleao_take_research_quota()','execute') as ok")).rows[0].ok,false);
 }finally{await sql.close()}});
