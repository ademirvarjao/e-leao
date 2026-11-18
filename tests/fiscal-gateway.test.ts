import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db,queryRTC,renderDanfse,friendly} from '../src/lib/client';
import {integrationMessages} from '../src/lib/messages';

test('gateway: o motor retorna JSON direto e DANFSe retorna PDF, não envelopes intercambiáveis',async t=>{
  t.after(async()=>{await db.auth.dispose();await db.realtime.disconnect()});
  const body={objetos:[{estadoItem:'CALCULADO'}]};
  let data:unknown=body, status=200;const headers=new Headers({'x-warning-dados-simulados':'6'});
  t.mock.method(Object.getPrototypeOf(db.functions),'invoke',async()=>({data,error:status===200?null:Error('internal detail'),response:new Response(null,{status,headers})}));
  assert.deepEqual(await queryRTC('regular',{}),{body,status:200,warning:'6'});
  headers.delete('x-warning-dados-simulados');assert.equal((await queryRTC('base',{})).warning,null);
  data=null;await assert.rejects(queryRTC('simple',{}),{message:integrationMessages.invalid});
  data=new Blob(['%PDF-1.7'],{type:'application/pdf'});const payload={xml:'<NFSe/>',stc:0,canhoto:true};
  assert.equal(await renderDanfse(payload),data);data=new Blob(['<html/>'],{type:'application/pdf'});await assert.rejects(renderDanfse(payload),/não retornou um PDF/);
  status=429;await assert.rejects(queryRTC('base',{}),e=>friendly(e)===integrationMessages.quota);
});

test('Edge expõe o aviso real do motor, sem inventar um aviso na ausência do cabeçalho',async t=>{
  let handle!:(request:Request)=>Promise<Response>,upstream=new Response('{}',{headers:{'x-warning-dados-simulados':'6'}});
  const env:Record<string,string>={SUPABASE_URL:'https://auth.example.test',SUPABASE_ANON_KEY:'public-fixture',RTC_REGULAR_URL:'https://rtc.example.test'};
  Object.defineProperty(globalThis,'Deno',{value:{env:{get:(k:string)=>env[k]},serve:(fn:typeof handle)=>{handle=fn}},configurable:true});
  t.after(()=>Reflect.deleteProperty(globalThis,'Deno'));
  t.mock.method(globalThis,'fetch',async(input:URL|string,init?:RequestInit)=>{
    const url=new URL(input);
    if(url.origin===env.SUPABASE_URL&&url.pathname==='/auth/v1/user')return Response.json({id:'d8489e08-02cf-40ce-8583-87e090936a3a',email_confirmed_at:'2026-01-01'});
    if(url.origin===env.SUPABASE_URL&&url.pathname==='/rest/v1/rpc/eleao_take_quota')return Response.json(true);
    assert.equal(url.href,'https://rtc.example.test/api/calculadora/observabilidade/regime-geral');
    assert.equal(new Headers(init?.headers).has('x-warning-dados-simulados'),false);
    return upstream;
  });
  await import('../supabase/functions/eleao-api/index.ts');
  const invoke=()=>handle(new Request('https://gateway.example.test',{method:'POST',headers:{origin:'https://ademirvarjao.github.io',authorization:'Bearer local-test-fixture-only','content-type':'application/json'},body:JSON.stringify({action:'regular',payload:{}})}));
  const result=await invoke();assert.equal(result.status,200);assert.equal(result.headers.get('x-warning-dados-simulados'),'6');
  assert.equal(result.headers.get('access-control-expose-headers'),'x-warning-dados-simulados');
  upstream=Response.json({objetos:[]});assert.equal((await invoke()).headers.has('x-warning-dados-simulados'),false);
  upstream=new Response('fixture',{status:422});assert.equal((await invoke()).status,422);
});
