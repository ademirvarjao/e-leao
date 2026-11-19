import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkFiscalService,checkPublishedDbVersion,db,friendly,queryRTC} from '../src/lib/client';
import {integrationMessages as msg} from '../src/lib/messages';

test('diagnóstico no navegador: distingue falta de instância, rede, sessão, rota e versão sem exibir erros do servidor',async t=>{
  t.after(async()=>{await db.auth.dispose();await db.realtime.disconnect()});
  let response:Response|undefined, data:unknown;
  const invoke=t.mock.method(Object.getPrototypeOf(db.functions),'invoke',async()=>({data,error:response?.ok?null:Error('detalhe restrito'),response}));
  const rejected=async(status:number,body:unknown,expected:string)=>{
    response=Response.json(body,{status});await assert.rejects(queryRTC('base',{}),e=>friendly(e)===expected);
  };
  await rejected(502,{error:'Este serviço não está configurado pelo administrador. Consulte as instruções de implantação.'},msg.notConfigured);
  await rejected(503,{code:'RTC_NOT_CONFIGURED'},msg.notConfigured);
  await rejected(502,{code:'RTC_ROUTE'},msg.route); await rejected(502,{code:'RTC_UPSTREAM_AUTH'},msg.upstreamAuth);
  await rejected(502,{error:'detalhe restrito',code:'desconhecido'},msg.unavailable);
  await rejected(503,{code:'RTC_GATEWAY_UNAVAILABLE'},msg.gateway);
  await rejected(401,{},msg.session);await rejected(429,{},msg.quota);await rejected(504,{},msg.timeout);
  response=undefined;await assert.rejects(queryRTC('regular',{}),e=>friendly(e)===msg.network);
  response=Response.json({error:'Ação não reconhecida.'},{status:404});await assert.rejects(checkFiscalService('base'),e=>friendly(e)===msg.oldGateway);
  response=new Response();data={reachable:true,service:'simple',dbVersion:'V0059'};
  assert.deepEqual(await checkFiscalService('simple'),{appVersion:undefined,dbVersion:'V0059'});
  assert.deepEqual(invoke.mock.calls.at(-1)!.arguments[1].body,{action:'check-service',payload:{service:'simple'}});
  await assert.rejects(checkFiscalService('regular'),e=>friendly(e)===msg.invalid);
  assert.equal(await checkPublishedDbVersion(),'V0059');assert.deepEqual(invoke.mock.calls.at(-1)!.arguments[1].body,{action:'reference-version',payload:{}});
  data={dbVersion:'https://nao-mostrar.example.test'};await assert.rejects(checkPublishedDbVersion(),e=>friendly(e)===msg.invalid);
});

test('gateway fiscal: configuração, isolamento do piloto e sondas de leitura',async t=>{
  const env:Record<string,string>={SUPABASE_URL:'https://workspace.example.test',SUPABASE_ANON_KEY:'public-fixture',RTC_API_TOKEN:'motor-fixture',DANFSE_API_TOKEN:'pdf-fixture'};
  let handle!:(r:Request)=>Promise<Response>,active=true,quota=true;
  let upstream=()=>Response.json({versaoApp:'1.6.1',versaoDb:'V0059'});
  const rpc:string[]=[], external:{url:string;init:RequestInit}[]=[];
  Object.defineProperty(globalThis,'Deno',{configurable:true,value:{env:{get:(k:string)=>env[k]},serve:(f:typeof handle)=>handle=f}});
  t.after(()=>Reflect.deleteProperty(globalThis,'Deno'));
  t.mock.method(globalThis,'fetch',async(input:URL|string,init:RequestInit={})=>{
    const url=new URL(input);
    if(url.origin===env.SUPABASE_URL){
      if(url.pathname==='/auth/v1/user')return Response.json({id:'d8489e08-02cf-40ce-8583-87e090936a3a',email_confirmed_at:'2026-01-01'});
      const name=url.pathname.split('/').at(-1)!;rpc.push(name);assert.ok(['eleao_is_active','eleao_take_quota'].includes(name));return Response.json(active && (name!=='eleao_take_quota'||quota));
    }
    external.push({url:url.href,init});return upstream();
  });
  await import('../supabase/functions/eleao-api/index.ts');
  const call=(action:string,payload:unknown={},auth=true)=>handle(new Request('https://edge.example.test',{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer workspace-fixture-only'}:{})},body:JSON.stringify({action,payload})}));
  const check=(service:string)=>call('check-service',{service});
  await t.test('sem URL: nem chamada externa nem débito; autenticação e perfil ativo continuam necessários',async()=>{
    assert.equal((await call('check-service',{service:'regular'},false)).status,401);
    active=false;assert.equal((await check('base')).status,403);active=true;
    for(const s of ['regular','simple','base','danfse']) {
      const res=await check(s);assert.equal(res.status,503);assert.equal((await res.json()).code,'RTC_NOT_CONFIGURED');
    }
    assert.equal((await (await call('regular')).json()).code,'RTC_NOT_CONFIGURED');
    env.RTC_REGULAR_URL='https://github.com/ReceitaFederal/calculadora-rtc-regime-regular';assert.equal((await (await check('regular')).json()).code,'RTC_INVALID_CONFIG');
    assert.equal(external.length,0);assert.ok(rpc.every(name=>name==='eleao_is_active'));
  });
  await t.test('sondas usam a rota do serviço e não incluem dados fiscais; base unificada herda o regular e respeita override',async()=>{
    env.RTC_REGULAR_URL='https://rtc.example.test/instalacao/api/';env.RTC_SIMPLE_URL='https://simple.example.test/prefixo';env.RTC_DANFSE_URL='https://pdf.example.test';
    const start=external.length;
    quota=false;assert.equal((await check('regular')).status,429);quota=true;
    assert.equal((await call('check-service',{service:'regular',dados:{}})).status,400);assert.equal(external.length,start);
    for(const [s,url] of [['regular','https://rtc.example.test/instalacao/api/calculadora/dados-abertos/versao'],['base','https://rtc.example.test/instalacao/api/calculadora/dados-abertos/versao'],['simple','https://simple.example.test/prefixo/api/versao']]){
      assert.deepEqual(await (await check(s)).json(),{service:s,reachable:true,appVersion:'1.6.1',dbVersion:'V0059'});
      const last=external.at(-1)!;assert.equal(last.url,url);assert.equal(last.init.method,'GET');assert.equal(last.init.body,undefined);assert.equal(last.init.redirect,'manual');assert.equal(new Headers(last.init.headers).get('authorization'),'Bearer motor-fixture');
    }
    env.RTC_BASE_URL='https://base.example.test/filial/';upstream=()=>Response.json({baseRG:100});
    const res=await call('base',{anoFatoGerador:2026});assert.deepEqual(await res.json(),{baseRG:100});assert.equal(external.at(-1)!.url,'https://base.example.test/filial/api/calculadora/base-calculo/base-calculo-unificada-nfse');
    upstream=()=>Response.json({status:'ok'});assert.deepEqual(await (await check('danfse')).json(),{service:'danfse',reachable:true});
    assert.equal(external.at(-1)!.url,'https://pdf.example.test/health/ready');assert.equal(new Headers(external.at(-1)!.init.headers).get('authorization'),'Bearer pdf-fixture');
  });
  await t.test('o caminho de cálculo do Simples e a geração de PDF continuam independentes das sondas',async()=>{
    upstream=()=>Response.json({objetos:[{estadoItem:'CALCULADO'}]});const sn={itens:[{numero:1,cAtivSN:'09'}]};
    assert.equal((await call('simple',sn)).status,200);assert.equal(external.at(-1)!.url,'https://simple.example.test/prefixo/api/calculadora/observabilidade/simples-nacional');assert.equal(external.at(-1)!.init.body,JSON.stringify(sn));
    const payload={xml:'<NFSe/>',stc:0,canhoto:false};upstream=()=>new Response('%PDF-test',{headers:{'content-type':'application/pdf'}});
    const pdf=await call('danfse',payload);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.equal(await pdf.text(),'%PDF-test');
    assert.equal(external.at(-1)!.url,'https://pdf.example.test/api/danfse?stc=0&canhoto=false');assert.equal(external.at(-1)!.init.body,payload.xml);
    upstream=()=>Response.json({status:'ok'});assert.equal((await (await call('danfse',payload)).json()).code,'RTC_INVALID_RESPONSE');
  });
  await t.test('não declara saúde com HTML, erro HTTP, timeout ou conexão recusada',async()=>{
    for(const [status,code] of [[403,'RTC_UPSTREAM_AUTH'],[404,'RTC_ROUTE'],[301,'RTC_ROUTE'],[500,'RTC_UPSTREAM_UNAVAILABLE']] as const){
      upstream=()=>new Response('detalhe restrito',{status});const res=await check('regular');assert.equal(res.status,502);const e=await res.json();assert.equal(e.code,code);assert.doesNotMatch(e.error,/detalhe restrito/);
    }
    upstream=()=>new Response('<html/>');assert.equal((await (await check('base')).json()).code,'RTC_INVALID_RESPONSE');
    upstream=()=>Response.json({});assert.equal((await (await check('simple')).json()).code,'RTC_INVALID_RESPONSE');
    upstream=()=>{throw new DOMException('detalhe restrito','TimeoutError')};assert.equal((await check('simple')).status,504);
    upstream=()=>{throw Error('detalhe restrito')};assert.equal((await (await check('base')).json()).code,'RTC_UPSTREAM_UNAVAILABLE');
  });
  await t.test('piloto: somente GET fixo de versão, sem credenciais, sem payload nem fallback de cálculo',async()=>{
    delete env.RTC_REGULAR_URL;const start=external.length;
    assert.equal((await call('reference-version',{codigo:'123'})).status,400);assert.equal(external.length,start);
    upstream=()=>Response.json({versaoDb:'V0059',ambiente:'piloto',outro:'não reenviar'});
    assert.deepEqual(await (await call('reference-version')).json(),{dbVersion:'V0059'});const {url,init}=external.at(-1)!;
    assert.equal(url,'https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/api/calculadora/dados-abertos/versao');assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.redirect,'error');assert.deepEqual(Object.fromEntries(new Headers(init.headers)),{accept:'application/json'});
    upstream=()=>Response.json({});assert.equal((await (await call('reference-version')).json()).code,'RTC_REFERENCE_UNAVAILABLE');
    assert.equal((await (await call('regular')).json()).code,'RTC_NOT_CONFIGURED');assert.equal(external.length,start+2);
  });
});
