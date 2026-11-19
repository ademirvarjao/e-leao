import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicTerms,validTerms,validHit,selectHits,validResearch,taxNames} from '../supabase/functions/_shared/research';
import {readDou,readLexml,readReceita,lexmlQuery} from '../supabase/functions/eleao-api/research';
import {createResearchSession,makeWebPrompt,webAnswer,termsForResearch,searchOfficial} from '../src/lib/webResearch';
import {db} from '../src/lib/client';

const douItem={urlTitle:'ato-de-teste-1',title:'Créditos da CBS',content:'<b>O crédito de CBS</b> depende das condições previstas no ato.',pubDate:'01/09/2026'};
const markup=(rows:unknown)=>`<script id="_br_com_seatecnologia_in_buscadou_BuscaDouPortlet_params" type="application/json">${JSON.stringify({jsonArray:rows})}</script>`;
const gov='https://www.gov.br/receitafederal/pt-br/assuntos/noticias/exemplo';
const rss=`<rss><channel><item><title>Orientação sobre crédito de CBS</title><link>${gov}</link><description><![CDATA[O crédito da <b>CBS</b> não é automático. Consulte o ato aplicável.]]></description><pubDate>01/09/2026</pubDate></item></channel></rss>`;
const urn='urn:lex:br:federal:lei.complementar:2025-01-16;214';
const sru=`<srw:searchRetrieveResponse xmlns:srw="http://www.loc.gov/zing/srw/" xmlns:dc="http://purl.org/dc/elements/1.1/"><srw:records><srw:record><srw:recordData><facet-tipoDocumento>Legislação::Lei Complementar</facet-tipoDocumento><urn>${urn}</urn><dc:title>Lei Complementar de teste</dc:title><dc:description>Disciplina o crédito de CBS.</dc:description></srw:recordData></srw:record></srw:records></srw:searchRetrieveResponse>`;
const [hit]=readReceita(rss),data={hits:[hit],checkedAt:'2026-11-18T12:00:00Z',unavailable:[]};

test('somente tópicos públicos e ano saem do dispositivo, inclusive em continuação',()=>{
  assert.deepEqual(publicTerms('Posso emitir NFS-e para Nome Particular, cpf 123.456.789-01, email@exemplo.test, R$ 700,00?'),['NFS-e','emissão']);
  assert.deepEqual(publicTerms('Assine este XML em https://exemplo.test/x?id=123'),[]);assert.deepEqual(publicTerms('só 2026?'),[]);
  assert.deepEqual(termsForResearch('E em 2027?','Qual o crédito de CBS de 2026?'),['CBS','crédito','2027']);
  const meaning=termsForResearch('o que é IBS e CBS?');assert.deepEqual(meaning,[taxNames.IBS,taxNames.CBS]);assert.ok(validTerms(meaning));
  assert.equal(selectHits(meaning,[{...hit,title:'Alíquotas de IBS e CBS',excerpt:'As alíquotas constam do ato.'}]).length,0);
  assert.deepEqual(termsForResearch('Pode resumir?','o que é IBS e CBS?'),meaning);
  assert.deepEqual(termsForResearch('E as alíquotas?','O que é o IBS?'),['IBS','alíquota']);
  assert.deepEqual(publicTerms('crédito presumido de IBS'),['IBS','crédito presumido']);
  assert.deepEqual(termsForResearch('Outro assunto?','CBS'),[]);
  for(const terms of [[],['2026'],['CBS','nome externo'],['CBS','IBS','IBS'],['CBS','2026','2027'],['__proto__'],{terms:['CBS']}])assert.equal(validTerms(terms),false);
});
test('lê RSS/Atom, ementas de legislação federal e o JSON do DOU; não executa HTML nem aceita fontes externas',()=>{
  assert.equal(hit.excerpt,'O crédito da CBS não é automático. Consulte o ato aplicável.');
  assert.equal(readDou(markup([douItem]))[0].url,'https://www.in.gov.br/web/dou/-/ato-de-teste-1');assert.deepEqual(readDou(markup([{...douItem,urlTitle:'//exemplo.test'}])),[]);
  assert.equal(lexmlQuery(['LC 214','CBS']),`urn = "${urn}"`);assert.equal(lexmlQuery(['CBS','2026']),'dc.description all "CBS"');
  assert.ok(validHit(readDou(markup([{...douItem,urlTitle:'instrução-nº-2.001-99'}]))[0]));
  assert.equal(readLexml(sru)[0].url,`https://www.lexml.gov.br/urn/${urn}`);assert.deepEqual(readLexml(sru.replace('Legislação::','Proposições::')),[]);
  assert.ok(validHit(readReceita(`<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>CBS</title><summary>Texto sobre a CBS.</summary><link href="${gov}"/></entry></feed>`)[0]));
  assert.throws(()=>readReceita('<!DOCTYPE rss><rss/>'));assert.throws(()=>readLexml('<html/>'));assert.throws(()=>readDou('<html>manutenção</html>'));
  const rows=[...readReceita(rss),...readDou(markup([douItem])),...readLexml(sru)];
  assert.equal(selectHits(['CBS','crédito'],[hit,...rows]).length,3);assert.equal(selectHits(['CBS','restituição'],rows).length,0);assert.equal(selectHits(['CBS','2026'],rows).length,0);
  for(const url of ['http://www.gov.br/receitafederal/pt-br/n','https://www.gov.br.notgov.test/receitafederal/pt-br/n','https://user@www.gov.br/receitafederal/pt-br/n','https://www.gov.br/fora','javascript:alert(1)'])assert.equal(validHit({...hit,url}),false);
  assert.equal(validResearch({...data,hits:[{...hit,provider:'dou'}]}),false);
});
test('a inferência recebe trechos como dados e só publica texto e citação sustentados pela mesma fonte',()=>{
  const prompt=makeWebPrompt('Qual o crédito?',[hit]);assert.ok(!prompt[0].content.includes(hit.excerpt));assert.ok(prompt[1].content.includes(hit.excerpt));
  const other={...hit,excerpt:'Outro trecho.'};assert.deepEqual(webAnswer('2',[other,hit]),{text:hit.excerpt,index:1});
  assert.deepEqual(webAnswer('[1]',[hit]),{text:hit.excerpt,index:0});
  for(const out of ['é automático. [1]','Crédito de 35%. [1]','[3]','https://example.test [1]','SEM_BASE','O crédito é automático.','[1] [2]'])assert.equal(webAnswer(out,[hit]),undefined);
});
test('o cliente rejeita resposta malformada e não exibe a mensagem privada do servidor',async t=>{
  let status=200,body:unknown={hits:[{...hit,url:'https://falso.test'}]};
  const invoke=t.mock.method(Object.getPrototypeOf(db.functions),'invoke',async()=>({response:new Response(null,{status}),data:body,error:status===200?null:Error('internal details')}));
  const signal=new AbortController().signal;await assert.rejects(searchOfficial(['CBS'],signal),/origem/);
  status=429;await assert.rejects(searchOfficial(['CBS'],signal),/limite diário/);status=200;body=data;assert.deepEqual(await searchOfficial(['CBS'],signal),data);
  assert.deepEqual(invoke.mock.calls.at(-1)!.arguments,['eleao-api',{body:{action:'official-search',payload:{terms:['CBS']}},signal}]);
  await db.auth.dispose();await db.realtime.disconnect();
});
test('cache volátil, cancelamento e limite de espera descartam a pesquisa antiga sem repetir envio',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});const events:string[]=[],jobs:{resolve:(r:typeof data)=>void;signal:AbortSignal}[]=[];
  const session=createResearchSession((_terms,signal)=>new Promise(resolve=>jobs.push({resolve,signal})));
  const done=(x:any)=>events.push(x.kind+(x.cached?' cache':''));session.run(['IBS'],done);session.run(['CBS'],done);
  assert.ok(jobs[0].signal.aborted);jobs[0].resolve(data);jobs[1].resolve(data);await Promise.resolve();session.run(['CBS'],done);assert.equal(jobs.length,2);
  session.run(['NCM'],done);t.mock.timers.tick(16_001);assert.ok(jobs[2].signal.aborted);jobs[2].resolve(data);await Promise.resolve();
  assert.deepEqual(events,['stopped','found','found cache','failed']);session.clear();
});
test('gateway autenticado consulta três origens fixas sem credenciais, diferencia falhas parciais, vazio e indisponibilidade',async t=>{
  let handle!:(r:Request)=>Promise<Response>;const env:Record<string,string>={SUPABASE_URL:'https://auth.test',SUPABASE_ANON_KEY:'fixture'};
  Object.defineProperty(globalThis,'Deno',{value:{env:{get:(k:string)=>env[k]},serve:(f:typeof handle)=>{handle=f}},configurable:true});t.after(()=>Reflect.deleteProperty(globalThis,'Deno'));
  let charge=0,allowed=true,fail=new Set<string>(),empty=false;const queries:URL[]=[];
  t.mock.method(globalThis,'fetch',async(input:URL|string,init?:RequestInit)=>{
    const url=new URL(input);if(url.origin===env.SUPABASE_URL){
      if(url.pathname==='/auth/v1/user')return Response.json({id:'d8489e08-02cf-40ce-8583-87e090936a3a',email_confirmed_at:'2026-01-01'});
      assert.equal(url.pathname,'/rest/v1/rpc/eleao_take_research_quota');charge++;return Response.json(allowed);
    }
    queries.push(url);assert.equal(init?.redirect,'error');assert.equal(init?.credentials,'omit');assert.equal(init?.method,'GET');assert.equal(init?.body,undefined);
    for(const key of ['authorization','cookie','apikey'])assert.equal(new Headers(init?.headers).has(key),false);
    if(fail.has(url.hostname))return new Response('private upstream body',{status:503});
    if(url.hostname==='www.in.gov.br'){assert.equal(url.searchParams.get('q'),'CBS crédito');return new Response(markup(empty?[]:[douItem]))}
    if(url.hostname==='www.gov.br'){assert.equal(url.search,'');return new Response(empty?'<rss/>':rss)}
    assert.equal(url.hostname,'www.lexml.gov.br');assert.match(url.searchParams.get('query')!,/CBS crédito/);return new Response(empty?'<searchRetrieveResponse/>':sru);
  });
  await import('../supabase/functions/eleao-api/index.ts');
  const ask=(payload:unknown,token=true)=>handle(new Request('https://edge.test',{method:'POST',headers:{authorization:token?'Bearer test-member-credential':'','content-type':'application/json'},body:JSON.stringify({action:'official-search',payload})}));
  const payload={terms:['CBS','crédito']};assert.equal((await ask(payload,false)).status,401);assert.equal((await ask({...payload,url:'https://attacker.test'})).status,400);assert.equal((await ask({terms:['CBS','segredo']})).status,400);assert.equal(charge,0);
  allowed=false;assert.equal((await ask(payload)).status,429);assert.equal(queries.length,0);allowed=true;
  const response=await ask(payload);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).hits.length,3);assert.equal(queries.length,3);
  fail.add('www.in.gov.br');const partial=await (await ask(payload)).json();assert.deepEqual(partial.unavailable,['dou']);assert.equal(partial.hits.length,2);
  empty=true;assert.deepEqual((await (await ask(payload)).json()).hits,[]);fail=new Set(queries.map(u=>u.hostname));assert.equal((await ask(payload)).status,503);
});
