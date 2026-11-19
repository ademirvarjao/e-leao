// Optional browser test of the built site. No real account, fiscal data or external API calls.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdtemp,readdir,rm,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {extname,join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {articles} from '../src/lib/knowledge.ts';
import {lc214} from '../src/lib/legal.ts';
import {transitionGuide} from '../src/lib/rateReferences.ts';
import {validTerms} from '../supabase/functions/_shared/research.ts';
import {modelURL,modelBytes,modelSha256} from '../src/lib/modelSpec.ts';

const file=process.env.E_LEAO_GGUF, executablePath=process.env.CHROMIUM_PATH;
if(!file||!executablePath)throw Error('Informe E_LEAO_GGUF e CHROMIUM_PATH (ver docs/IMPLANTACAO.md).');
assert.equal((await stat(file)).size,modelBytes);
const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
assert.equal(hash.digest('hex'),modelSha256,'Pesos diferentes da revisão publicada');
const dist=resolve('dist'), files=new Set(await readdir(dist,{recursive:true}));
assert.ok(files.has('index.html'),'Execute npm run build primeiro.');
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.woff2':'font/woff2'};
let downloads=0;
const server=createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
  if(req.url==='/pointer'){res.end(`version https://git-lfs.github.com/spec/v1\noid sha256:${modelSha256}\nsize ${modelBytes}\n`);return}
  const name=req.url==='/e-leao/'?'index.html':req.url?.slice('/e-leao/'.length);
  const path=req.url==='/weights'?file:req.url?.startsWith('/e-leao/')&&files.has(name)?join(dist,name):null;
  if(!path){res.writeHead(404).end();return}
  const info=await stat(path);
  if(!info.isFile()){res.writeHead(404).end();return}
  res.writeHead(200,{'content-length':info.size,'content-type':mime[extname(path)]||'application/octet-stream'});
  if(req.method==='HEAD'){res.end();return}if(path===file)downloads++;
  const stream=createReadStream(path);res.on('close',()=>stream.destroy());stream.pipe(res);
});

const profile=await mkdtemp(join(tmpdir(),'eleao-ia-'));let context;
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  context=await chromium.launchPersistentContext(profile,{executablePath,headless:true,args:['--disable-gpu'],serviceWorkers:'block'});
  const errors=[],unexpected=[],user={id:'membro-de-teste',email:'membro@example.test'};
  const searchQueries=[];
  // Search results and account APIs are fixtures. Model/worker, grounding and UI are real.
  const webHit={provider:'lexml',title:'LC 214 — trecho de teste',url:'https://www.lexml.gov.br/urn/urn:lex:br:federal:lei.complementar:2025-01-16;214',excerpt:'IBS significa Imposto sobre Bens e Serviços.'};
  // Every request leaving loopback is intercepted (never forwarded to a real project).
  const fixtures=new Map([
    ['POST /auth/v1/token',{user,access_token:'local-test-only',refresh_token:'local-test-only',expires_in:3600,token_type:'bearer'}],
    ['POST /rest/v1/rpc/eleao_join',true],['POST /rest/v1/rpc/eleao_claim_owner',false],
    ['GET /rest/v1/eleao_profiles',{id:user.id,display_name:'Membro de teste',active:true,role:'member',approval_status:'approved'}],
    ['GET /rest/v1/eleao_operations',[]],['GET /rest/v1/eleao_articles',articles],
  ]);
  await context.route('**/*',route=>{
    const req=route.request(), url=new URL(req.url());
    if(url.origin===origin)return route.continue();
    const key=`${req.method()} ${url.pathname}`;
    if(key==='POST /functions/v1/eleao-api'){
      const {action,payload}=req.postDataJSON();assert.equal(action,'official-search');assert.deepEqual(Object.keys(payload),['terms']);assert.ok(validTerms(payload.terms));searchQueries.push(payload.terms);
      return route.fulfill({json:{checkedAt:new Date().toISOString(),unavailable:[],hits:payload.terms.includes('LC 214')?[webHit]:[]}});
    }
    if(fixtures.has(key))return route.fulfill({json:fixtures.get(key)});
    unexpected.push(key);return route.abort();
  });
  await context.addInitScript(url=>{
    localStorage.setItem('eleao-assistente-pesquisa','off'); // A superseded setting must not disable the tool.
    const get=window.fetch.bind(window);window.fetch=(input,init)=>{
      if(input===url)return get('/weights',init);
      if(input===url.replace('/resolve/','/raw/'))return get('/pointer',init);
      return get(input,init);
    };
  },modelURL);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/e-leao/#/visao-geral');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  const login=page.getByRole('dialog');await login.getByLabel('E-mail',{exact:true}).fill(user.email);
  await login.locator('input[autocomplete="current-password"]').fill('somente-teste');
  await login.getByRole('button',{name:'Entrar na sua conta'}).click();
  const link=page.getByRole('link',{name:'Assistente fiscal',exact:true});await link.waitFor();assert.equal(downloads,0,'A página inicial não baixa a IA');
  await link.click();
  const ready=page.locator('.chat[data-mode="ready"]');await ready.waitFor({timeout:120_000});
  assert.equal(await page.getByRole('checkbox',{name:/pesquis/i}).count(),0);
  const start=Date.now();
  await page.getByRole('button',{name:transitionGuide.question,exact:true}).click();
  const direct=page.locator('.bubble.agent').filter({hasText:'e-Leão · Guia revisado'});
  await direct.waitFor({timeout:3000});assert.equal(await direct.locator('p').innerText(),transitionGuide.answer);
  assert.equal(await direct.getByRole('link',{name:transitionGuide.question}).getAttribute('href'),transitionGuide.source);
  assert.equal(await page.getByRole('button',{name:/Cancelar explicação/}).count(),0);
  console.log(`Pergunta das alíquotas: guia com fonte em ${Date.now()-start} ms, sem cancelar.`);
  const ask=async question=>{
    await page.getByLabel('Sua pergunta').fill(question);
    await page.getByRole('button',{name:'Enviar pergunta'}).click();
  };
  // The actual typed report: after a turn about rates, ask for meanings. The
  // legal definitions must arrive with the right source and no generation queued.
  await ask('o que é ibs e cbs?');
  const definition=page.locator('.bubble.agent').last();
  assert.match(await definition.locator('p').innerText(),/Imposto sobre Bens e Serviços.*Contribuição Social sobre Bens e Serviços/);
  assert.doesNotMatch(await definition.locator('p').innerText(),/alíquota|%|2026/i);
  assert.equal(await definition.getByRole('link').getAttribute('href'),lc214);
  assert.equal(await definition.locator('small').innerText(),'e-Leão · Guia revisado');
  assert.equal(await page.getByRole('button',{name:/Cancelar explicação/}).count(),0);
  console.log('Pergunta digitada sobre IBS e CBS: definições legais, sem confundir com a pergunta anterior sobre alíquotas.');
  assert.equal(searchQueries.length,0,'As respostas diretas com fonte não gastam a cota da ferramenta');
  // Interrupt a real worker, not the FAQ shortcut; never revive its cancelled turn.
  await ask('Como preparo um rascunho de nota de serviço?');
  await page.getByRole('button',{name:'Cancelar explicação'}).click();
  await page.getByText(/Explicação interrompida/).waitFor();await ready.waitFor({timeout:60_000});
  const answers=page.locator('.bubble.agent');assert.equal(await answers.count(),3);
  assert.equal(await answers.last().locator('small').innerText(),'e-Leão · Guia revisado');
  await ask('Para que serve o DANFSe?');
  await page.locator('.bubble.agent').last().getByRole('link',{name:'O que é o DANFSe?'}).waitFor({timeout:3000});
  const reply=answers.last();
  // Wait for the actual tool and generation to finish. On abstention/failure,
  // report the state immediately instead of waiting 95 s for a label that won't appear.
  async function checkCompleted(turn,expected){
    await turn.locator('.research-result').waitFor({timeout:18_000});
    await turn.locator('.reply-progress').waitFor({state:'hidden',timeout:95_000});
    assert.equal(await turn.locator('small').innerText(),expected,[await turn.innerText(),...await page.locator('.chat-notice').allInnerTexts()].join('\n'));
  }
  await checkCompleted(reply,'e-Leão · IA local');assert.equal(await answers.count(),4);
  const text=await reply.locator('p').innerText();assert.match(text,/nota|pdf|nfs|auxiliar/i);
  assert.ok(await reply.getByRole('link',{name:'O que é o DANFSe?'}).count());
  const beforeLookup=searchQueries.length;
  await ask('Segundo a LC 214, o que significa IBS?');
  const online=page.locator('.bubble.agent').last();
  await checkCompleted(online,'e-Leão · IA local com fonte');
  assert.equal(await online.locator('p').innerText(),webHit.excerpt);
  assert.equal(await online.getByRole('link',{name:/LC 214 — trecho de teste/}).getAttribute('href'),webHit.url);
  assert.deepEqual(searchQueries.slice(beforeLookup),[['IBS','LC 214']],'Uma chamada interna, sem ativação manual');
  console.log('IA real leu o resultado de pesquisa de teste e respondeu com o trecho e a fonte correspondentes.');
  // Reload the whole page, not only the JS instance. A second transfer must not occur.
  await page.reload();await ready.waitFor({timeout:60_000});
  assert.equal(downloads,1,'O segundo carregamento deve reutilizar o cache');
  const cachedWeights=()=>page.evaluate(async()=>{
    const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle('cache');
    const sizes=[];for await(const f of dir.values())if(f.kind==='file'&&f.name.endsWith('.gguf'))sizes.push((await f.getFile()).size);
    return sizes;
  });
  assert.ok((await cachedWeights()).includes(modelBytes));
  await page.getByLabel('Opções da conversa').click();
  await page.getByRole('button',{name:'Apagar apenas o modelo em cache'}).click();
  await page.getByText(/Cache do modelo removido/).waitFor();assert.deepEqual(await cachedWeights(),[]);
  await page.reload();await page.getByRole('button',{name:'Voltar a usar a IA'}).waitFor();
  assert.deepEqual(await cachedWeights(),[]);assert.equal(downloads,1,'Remover os pesos não deve provocar novo download automático');
  // With no cached weights, a stalled/failed transfer must not hold the chat hostage.
  let release;const gate=new Promise(resolve=>{release=resolve});
  await page.route(origin+'/weights',async route=>{await gate;await route.fulfill({status:503,body:'Unavailable'})});
  const requested=page.waitForRequest(origin+'/weights');
  try {
    await page.getByRole('button',{name:'Voltar a usar a IA'}).click();await requested;
    const progress=page.getByRole('progressbar',{name:'Carregamento do assistente'});
    assert.match(await progress.locator('..').innerText(),/^\d+%$/);assert.doesNotMatch(await page.locator('main').innerText(),/Qwen|gratuit|cobrança/i);
    await page.getByRole('button',{name:transitionGuide.question,exact:true}).click();
    assert.equal(await answers.locator('p').innerText(),transitionGuide.answer);
  } finally {release()}
  await page.getByRole('button',{name:'Tentar carregar a IA novamente'}).waitFor();
  await ask('Para que serve o DANFSe?');assert.equal(await answers.count(),2);
  assert.ok(await answers.last().getByRole('link',{name:'O que é o DANFSe?'}).count());
  assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
  console.log(`Início automático, cancelamento, inferência real, reuso/remoção do cache e consulta durante falha de download confirmados. Resposta de teste: ${text}`);
}catch(error){
  const page=context?.pages().at(-1);
  if(page && !page.isClosed())console.error('Estado do teste:',await page.locator('.chat-notice, .bubble.agent:last-child').allInnerTexts().catch(()=>[]));
  throw error;
}finally{await context?.close();server.closeAllConnections();server.close();await rm(profile,{recursive:true,force:true})}
