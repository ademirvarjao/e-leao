import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('políticas RLS: isolamento, autocadastro confirmado e administración restrita',async()=>{
 const sql=new PGlite();try{await sql.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb); create function auth.uid() returns uuid stable language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 await sql.exec(await readFile(new URL('../supabase/migrations/20261118000100_eleao_workspace.sql',import.meta.url),'utf8'));await sql.exec(await readFile(new URL('../supabase/migrations/20261118000300_eleao_owner_claim.sql',import.meta.url),'utf8'));
 const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',u='cccccccc-cccc-4ccc-8ccc-cccccccccccc',v='dddddddd-dddd-4ddd-8ddd-dddddddddddd',owner='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';await sql.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'a@exemplo.test',now(),'{}'),($2,'b@exemplo.test',now(),'{"display_name":"Conta B"}'),($3,'c@exemplo.test',now(),'{"display_name":"Novo membro"}'),($4,'d@exemplo.test',null,'{}'),($5,'AdemirVarjao@gmail.com',now(),'{"display_name":"Ademir"}')`,[a,b,u,v,owner]);await sql.query(`insert into public.eleao_profiles(id,display_name,role) values($1,'Admin','admin'),($2,'Membro B','member')`,[a,b]);await sql.query(`insert into public.eleao_operations(owner_id,kind,title,on_date,regime,base_cents) values($1,'simulation','Privado de B','2027-01-01','Regime regular',100)`,[b]);
 let currentStep='migration/setup';const as=async(id:string,q:string,params:unknown[]=[])=>{await sql.exec('begin');try{await sql.exec('set local role authenticated');await sql.exec(`select set_config('request.jwt.claim.sub','${id}',true)`);const res=await sql.query(q,params);await sql.exec('commit');return res}catch(e){await sql.exec('rollback');throw e}};
 await sql.exec(await readFile(new URL('../supabase/migrations/20261118001500_research_quota.sql',import.meta.url),'utf8'));
 assert.equal((await as(b,'select count(*)::int as n from generate_series(1,41) where eleao_take_research_quota()')).rows[0].n,40);
 assert.equal((await as(b,'select eleao_take_research_quota() as ok')).rows[0].ok,false);
 assert.equal((await as(b,'select eleao_take_quota() as ok')).rows[0].ok,true); // independent RTC allowance
 assert.equal((await as(u,'select eleao_take_research_quota() as ok')).rows[0].ok,false);
 await assert.rejects(()=>as(b,'select * from eleao_research_usage'));
 currentStep='admin query';assert.equal((await as(a,'select public.eleao_is_admin() as ok')).rows[0].ok,true);assert.equal((await as(u,'select public.eleao_is_admin() as ok')).rows[0].ok,false);
 assert.equal((await as(a,'select count(*)::int as n from public.eleao_operations')).rows[0].n,1);assert.equal((await as(u,'select count(*)::int as n from public.eleao_operations')).rows[0].n,0);
 await assert.rejects(()=>as(a,`insert into public.eleao_operations(owner_id,kind,title,on_date,regime,base_cents) values($1,'simulation','Forjado','2027-01-01','Regime regular',100)`,[b]));
 await as(u,'select public.eleao_join()');assert.equal((await sql.query(`select display_name from public.eleao_profiles where id=$1`,[u])).rows[0].display_name,'Novo membro');
 await assert.rejects(()=>as(v,'select public.eleao_join()'));
 assert.equal((await as(u,'select public.eleao_claim_owner() as claimed')).rows[0].claimed,false);assert.equal((await as(owner,'select public.eleao_claim_owner() as claimed')).rows[0].claimed,true);assert.equal((await sql.query('select role from public.eleao_profiles where id=$1',[owner])).rows[0].role,'admin');
 await assert.rejects(()=>as(u,"select public.eleao_set_active($1,false)",[b]));
 await as(a,"select public.eleao_set_active($1,false)",[b]);assert.equal((await sql.query(`select active from public.eleao_profiles where id=$1`,[b])).rows[0].active,false);
 await assert.rejects(()=>as(a,"update public.eleao_profiles set role='member' where id=$1",[a]));assert.equal((await sql.query(`select role from public.eleao_profiles where id=$1`,[a])).rows[0].role,'admin');
 }finally{await sql.close()}
});
