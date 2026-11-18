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
  // Only the session/data service and the transport of the exact GGUF are fixtures.
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
    if(fixtures.has(key))return route.fulfill({json:fixtures.get(key)});
    unexpected.push(key);return route.abort();
  });
  await context.addInitScript(url=>{const get=window.fetch.bind(window);window.fetch=(input,init)=>{
    if(input===url)return get('/weights',init);
    if(input===url.replace('/resolve/','/raw/'))return get('/pointer',init);
    return get(input,init);
  }},modelURL);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/e-leao/#/assistente');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  const login=page.getByRole('dialog');await login.getByLabel('E-mail',{exact:true}).fill(user.email);
  await login.locator('input[autocomplete="current-password"]').fill('somente-teste');
  await login.getByRole('button',{name:'Entrar na sua conta'}).click();
  const activate=page.getByRole('button',{name:'Ativar IA neste dispositivo'});
  await activate.waitFor();assert.equal(downloads,0);
  await activate.click();await page.getByText('Modelo pronto',{exact:true}).waitFor({timeout:120_000});
  await page.getByLabel('Sua pergunta').fill('Para que serve o DANFSe?');
  await page.getByRole('button',{name:'Enviar pergunta'}).click();
  const reply=page.locator('.bubble.agent').filter({hasText:'e-Leão · IA local'});
  await reply.waitFor({timeout:125_000});
  const text=await reply.locator('p').innerText();assert.match(text,/nota|pdf|nfs|auxiliar/i);
  assert.ok(await reply.getByRole('link',{name:'O que é o DANFSe?'}).count());
  // Reload the whole page, not only the JS instance. A second transfer must not occur.
  await page.reload();await activate.click();await page.getByText('Modelo pronto',{exact:true}).waitFor({timeout:60_000});
  assert.equal(downloads,1,'O segundo carregamento deve reutilizar o cache');
  const cachedWeights=()=>page.evaluate(async()=>{
    const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle('cache');
    const sizes=[];for await(const f of dir.values())if(f.kind==='file'&&f.name.endsWith('.gguf'))sizes.push((await f.getFile()).size);
    return sizes;
  });
  assert.ok((await cachedWeights()).includes(modelBytes));
  await page.getByText('Modelo e armazenamento',{exact:true}).click();
  await page.getByRole('button',{name:'Apagar apenas o modelo em cache'}).click();
  await page.getByText(/Cache do modelo removido/).waitFor();assert.deepEqual(await cachedWeights(),[]);
  assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
  console.log(`IA local na tela, reuso e remoção do cache confirmados. Resposta de teste: ${text}`);
}finally{await context?.close();server.closeAllConnections();server.close();await rm(profile,{recursive:true,force:true})}
