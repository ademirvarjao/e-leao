import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React from 'react';
import {articles} from '../src/lib/knowledge';
import type {SearchOfficial} from '../src/lib/webResearch';
import type {Research} from '../supabase/functions/_shared/research';
import {lc214} from '../src/lib/legal';
import {transitionGuide} from '../src/lib/rateReferences';
import {answerIdleMs,answerLimitMs,type LocalModel,type ModelLoader,type ModelProgress} from '../src/lib/assistant';

function deferred<T>() {
  let resolve!:(value:T)=>void,reject!:(e:Error)=>void;
  const promise=new Promise<T>((ok,fail)=>{resolve=ok;reject=fail});return {promise,resolve,reject};
}
test('assistente fiscal: início automático e respostas visíveis sem cancelar',async t=>{
  const dom=new JSDOM('<!doctype html><body></body>',{url:'https://example.test/e-leao/'});
  for(const key of ['window','document','navigator','HTMLElement'] as const)Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
  const {render,screen,fireEvent,cleanup,waitFor,act}=await import('@testing-library/react');
  const {default:Assistant}=await import('../src/pages/Assistant');const {Ctx}=await import('../src/lib/workspace');const {db}=await import('../src/lib/client');
  const space={knowledge:articles,feedback:async()=>{},notify:()=>{}} as React.ContextType<typeof Ctx>;
  const open=(loadModel:ModelLoader,search?:SearchOfficial)=>render(React.createElement(React.StrictMode,null,React.createElement(Ctx.Provider,{value:search?{...space!,profile:{id:'member',display_name:'Teste',created_at:'',role:'member',active:true,approval_status:'approved'}}:space},React.createElement(Assistant,{loadModel,search}))));
  const ask=(question:string)=>{fireEvent.change(screen.getByLabelText('Sua pergunta'),{target:{value:question}});fireEvent.click(screen.getByLabelText('Enviar pergunta'))};
  const replies=()=>screen.getByRole('log').querySelectorAll('.bubble.agent');
  const ready=()=>waitFor(()=>assert.ok(document.querySelector('.chat[data-mode="ready"]')));
  const plain={close:()=>{},complete:async()=>''};
  t.afterEach(()=>{cleanup();dom.window.localStorage.clear()});
  t.after(async()=>{await db.auth.dispose();await db.realtime.disconnect();dom.window.close()});

  await t.test('abre uma vez, inclusive em StrictMode; a pergunta das alíquotas recebe o guia imediatamente',async()=>{
    const load=deferred<LocalModel>();let loads=0,calls=0,closed=0;
    const page=open(async(_s,progress)=>{loads++;progress(37);return load.promise});await waitFor(()=>assert.equal(loads,1));
    const bar=screen.getByRole('progressbar',{name:'Carregamento do assistente'});assert.equal(bar.getAttribute('value'),'37');assert.equal(bar.parentElement?.textContent,'37%');assert.doesNotMatch(document.body.textContent!,/gratuit|Qwen|API|cobrança/i);
    fireEvent.click(screen.getByRole('button',{name:transitionGuide.question}));
    assert.ok(screen.getByText(transitionGuide.answer));assert.ok(screen.getByRole('link',{name:transitionGuide.question}));
    await act(async()=>load.resolve({close:()=>{closed++},complete:async()=>{calls++;return ''}}));
    await ready();ask(transitionGuide.question.toUpperCase().replace('?',''));
    assert.equal(screen.getAllByText(transitionGuide.answer).length,2);assert.equal(calls,0);
    assert.equal(screen.queryByRole('button',{name:/Cancelar/}),null);assert.equal(replies().length,2);
    page.unmount();assert.equal(closed,1);
  });
  await t.test('a pergunta digitada na imagem recebe a definição, não percentuais; a IA pronta não a reescreve',async()=>{
    const load=deferred<LocalModel>();let calls=0;open(async()=>load.promise);
    ask('o que é ibs e cbs?');const first=replies()[0];
    assert.match(first.querySelector('p')!.textContent!,/Imposto sobre Bens e Serviços.*Contribuição Social sobre Bens e Serviços/);
    assert.doesNotMatch(first.textContent!,/alíquota|%|2026|Aguardando a IA/i);assert.equal(first.querySelector('a')!.href,lc214);
    assert.equal(first.querySelector('button'),null); // Published legal reference, not a database article to vote on.
    await act(async()=>load.resolve({close:()=>{},complete:async()=>{calls++;return transitionGuide.answer}}));await ready();
    ask(transitionGuide.question);assert.ok(screen.getByText(transitionGuide.answer));
    ask('O que significam as siglas CBS e IBS?');assert.equal(replies()[2].querySelector('p')!.textContent,first.querySelector('p')!.textContent);
    assert.equal(calls,0);assert.equal(screen.queryByRole('button',{name:/Cancelar/}),null);
  });
  const onlineResult:Research={checkedAt:'2026-11-18T12:00:00Z',unavailable:['dou'],hits:[{provider:'receita',title:'Orientação sobre créditos de CBS',excerpt:'O crédito da CBS não é automático. Consulte o enquadramento.',url:'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/teste'}]};
  await t.test('pesquisa automática informa o envio, exibe título, órgão, trecho e link; o modelo lê a pesquisa antes de responder',async()=>{
    const lookup=deferred<Research>();const queries:string[][]=[];let calls=0;
    open(async()=>({close:()=>{},complete:async p=>{calls++;assert.ok(p[1].content.includes(onlineResult.hits[0].excerpt));return '1'}}),async terms=>{queries.push(terms);return lookup.promise});
    await ready();const q='E o crédito da CBS para Cliente Particular 123.456.789-01?';
    fireEvent.change(screen.getByLabelText('Sua pergunta'),{target:{value:q}});assert.ok(screen.getByText('Termos a enviar: CBS · crédito'));assert.equal(queries.length,0);
    fireEvent.click(screen.getByLabelText('Enviar pergunta'));assert.deepEqual(queries,[['CBS','crédito']]);assert.ok(screen.getByText('Pesquisando em fontes oficiais…'));assert.equal(calls,0);
    await act(async()=>lookup.resolve(onlineResult));await screen.findByText('e-Leão · IA local com fonte');assert.equal(calls,1);
    assert.equal(replies()[0].querySelector('p')!.textContent,onlineResult.hits[0].excerpt);assert.match(replies()[0].textContent!,/Fonte da resposta · Receita Federal/);
    assert.equal(screen.getByRole('link',{name:/Orientação sobre créditos/}).getAttribute('href'),onlineResult.hits[0].url);assert.ok(screen.getByText(/Consulta parcial/));
  });
  await t.test('guia exato não é sobrescrito pela busca, erros não bloqueiam a resposta e desativar impede o envio',async()=>{
    let count=0;const search:SearchOfficial=async()=>{if(++count===1)return onlineResult;throw Error('detalhe privado')};
    open(async()=>plain,search);await ready();ask('o que é ibs e cbs?');await screen.findByText(/Resultado relacionado · Receita Federal/);
    assert.match(replies()[0].querySelector('p')!.textContent!,/Imposto sobre Bens e Serviços/);assert.ok(screen.getByRole('link',{name:'O que são IBS e CBS?'}));
    ask('qual o percentual de IBS em 2026?');await screen.findByText(/Pesquisa indisponível/);assert.ok(screen.getByText(transitionGuide.answer));assert.equal(screen.queryByText('detalhe privado'),null);
    fireEvent.click(screen.getByRole('checkbox',{name:/Pesquisar na internet/}));ask('Qual o significado de CBS?');assert.equal(count,2);
  });
  await t.test('sem o modelo pronto a pesquisa já mostra a fonte; uma busca antiga não muda a resposta mais recente',async()=>{
    const load=deferred<LocalModel>(),old=deferred<Research>();let signal!:AbortSignal;let n=0;
    open(async()=>load.promise,async(_t,s)=>{if(!n++){signal=s;return old.promise}return onlineResult});
    ask('O que é IBS?');ask('Há crédito presumido de CBS?');await screen.findByText('e-Leão · Trecho da pesquisa');assert.ok(signal.aborted);
    await act(async()=>old.resolve(onlineResult));assert.equal(replies()[0].querySelector('.research-hit'),null);assert.equal(replies()[1].querySelector('.research-hit a')?.getAttribute('href'),onlineResult.hits[0].url);
    fireEvent.click(screen.getByLabelText('Opções da conversa'));fireEvent.click(screen.getByRole('button',{name:'Usar só os guias'}));ask('Qual é a CBS?');assert.equal(n,2);
  });
  await t.test('durante a carga já responde; explica a última pergunta livre usando o mesmo balão e valida o texto final',async()=>{
    const load=deferred<LocalModel>(),result=deferred<string>();let calls=0,pulse!:ModelProgress;
    open(async()=>load.promise);ask('Como preparo um rascunho?');assert.ok(screen.getByText(/Aguardando a IA para explicar/));ask('Para que serve o DANFSe?');
    const guide=articles.find(a=>a.id==='guia-5')!;assert.ok(screen.getByText(guide.answer));assert.equal(replies().length,2);
    await act(async()=>load.resolve({close:()=>{},complete:async(prompt,_s,_max,onProgress)=>{
      calls++;if(calls>1)return 'Aplica-se uma alíquota de 99%.';
      assert.equal(prompt[1].content,'Para que serve o DANFSe?');pulse=onProgress!;return result.promise;
    }}));
    assert.equal(calls,1);assert.ok(screen.getByText('A IA está lendo as fontes…'));
    act(()=>pulse('writing'));assert.ok(screen.getByText('A IA está redigindo a explicação…'));assert.ok(screen.getByText(guide.answer));
    await act(async()=>result.resolve('O DANFSe apresenta a nota autorizada em formato de leitura.'));
    assert.ok(screen.getByText('e-Leão · IA local'));assert.equal(replies().length,2);assert.ok(screen.getByRole('link',{name:guide.question}));
    ask('Pode resumir?');await screen.findByText(/Não foi possível confirmar a explicação/);
    assert.equal(screen.queryByText(/99%/),null);assert.equal(replies().length,3);assert.match(replies()[2].textContent!,/Guia revisado/);
  });
  await t.test('falha sem bloquear a conversa; respeita só guias após cancelar download, ignora carga atrasada e permite voltar ao automático',async()=>{
    const late=deferred<LocalModel>();let loads=0,closed=0,signal!:AbortSignal;
    const loader:ModelLoader=async s=>{loads++;if(loads===1)throw Error('private detail');if(loads===2){signal=s;return late.promise}return plain};
    let page=open(loader);await screen.findByText(/Não foi possível preparar a IA/);assert.equal(screen.queryByText(/private detail/),null);
    ask('Como emitir uma NFS-e?');assert.ok(screen.getByText('e-Leão · Guia revisado'));
    fireEvent.click(screen.getByRole('button',{name:'Tentar carregar a IA novamente'}));
    ask('Explique o DANFSe');fireEvent.click(screen.getByLabelText('Opções da conversa'));fireEvent.click(screen.getByRole('button',{name:'Usar só os guias'}));assert.ok(signal.aborted);
    await act(async()=>late.resolve({...plain,close:()=>{closed++}}));assert.equal(closed,1);assert.equal(document.querySelector('.chat[data-mode="ready"]'),null);
    page.unmount();page=open(loader);await act(async()=>{});assert.equal(loads,2);
    fireEvent.click(screen.getByRole('button',{name:'Voltar a usar a IA'}));await ready();assert.equal(loads,3);
    page.unmount();open(loader);await ready();assert.equal(loads,4);
  });
  await t.test('sem progresso, finaliza sozinha, preserva a resposta, libera a próxima pergunta e descarta o resultado tardio',async t=>{
    const late=deferred<string>();let loads=0,signal!:AbortSignal;
    open(async()=>++loads===1?{close:()=>{},complete:async(_p,s)=>{signal=s;return late.promise}}:{close:()=>{},complete:async()=>'Essa nota precisa de autorização no emissor.'});
    await ready();t.mock.timers.enable({apis:['setTimeout']});
    ask('Explique o DANFSe');assert.ok(screen.getByText('e-Leão · Guia revisado'));assert.ok(!signal.aborted);
    await act(async()=>t.mock.timers.tick(answerIdleMs+1));assert.ok(signal.aborted);assert.equal(loads,2);
    assert.equal(screen.queryByRole('button',{name:/Cancelar explicação/}),null);assert.ok(screen.getByText(/A IA demorou para concluir/));
    await act(async()=>late.resolve('Resposta atrasada.'));assert.equal(screen.queryByText('Resposta atrasada.'),null);assert.equal(replies().length,1);
    ask('Explique a emissão de NFS-e.');await act(async()=>{});assert.ok(screen.getByText('Essa nota precisa de autorização no emissor.'));assert.equal(replies().length,2);
  });
  await t.test('há limite total mesmo com o worker enviando progresso continuamente',async t=>{
    let signal!:AbortSignal,pulse!:ModelProgress,calls=0;
    open(async()=>({close:()=>{},complete:async(_p,s,_max,progress)=>{calls++;signal=s;pulse=progress!;return new Promise(()=>{})}}));
    await ready();t.mock.timers.enable({apis:['setTimeout']});ask('Explique o DANFSe.');
    await act(async()=>{for(let elapsed=0;elapsed<answerLimitMs;elapsed+=1000){t.mock.timers.tick(1000);pulse('writing')}});
    assert.ok(signal.aborted);assert.equal(calls,1);assert.ok(screen.getByText(/A IA demorou para concluir/));assert.equal(replies().length,1);
  });
  await t.test('outra pergunta não exige cancelar: FAQ não disputa o worker e a pergunta livre mais recente recebe a explicação',async()=>{
    const old=deferred<string>();let oldSignal!:AbortSignal,loads=0;
    open(async()=>++loads===1?{close:()=>{},complete:async(_p,s)=>{oldSignal=s;return old.promise}}:{close:()=>{},complete:async p=>{
      assert.equal(p[1].content,'Como preparo um rascunho?');return 'Confira os dados do rascunho antes de acessar o emissor.';
    }});
    await ready();ask('Explique o DANFSe.');ask(transitionGuide.question);
    assert.ok(screen.getByText(transitionGuide.answer));assert.ok(!oldSignal.aborted);
    ask('Como preparo um rascunho?');await screen.findByText('Confira os dados do rascunho antes de acessar o emissor.');
    await act(async()=>old.resolve('Texto descartado.'));assert.equal(screen.queryByText('Texto descartado.'),null);
    assert.ok(oldSignal.aborted);assert.equal(loads,2);assert.equal(replies().length,3);
  });
  await t.test('cancelar ou sair não duplica a resposta nem reabre a geração antiga',async()=>{
    const late=deferred<string>();let signal!:AbortSignal,closed=0,loads=0;
    const page=open(async()=>{loads++;return {close:()=>{closed++},complete:async(_p,s)=>{signal=s;return late.promise}}});
    await ready();ask('Para que serve o DANFSe?');assert.ok(screen.getByRole('link',{name:'O que é o DANFSe?'}));
    fireEvent.click(screen.getByRole('button',{name:'Cancelar explicação'}));assert.ok(signal.aborted);await ready();
    assert.equal(replies().length,1);assert.equal(loads,2);assert.equal(closed,1);
    ask('Explique melhor');assert.ok(!signal.aborted);page.unmount();assert.ok(signal.aborted);assert.equal(closed,2);
    await act(async()=>late.resolve('Texto antigo.'));assert.equal(screen.queryByText('Texto antigo.'),null);assert.equal(loads,2);
  });
  await t.test('rota sem correspondência mostra a fonte assim que identificada e não deixa a conversa pendente após erro',async()=>{
    const match=deferred<string>(),explanation=deferred<string>();let calls=0,choice='';
    open(async()=>({close:()=>{},complete:async(p,_s,max)=>{calls++;if(max!==8)return explanation.promise;choice=/^(\d+)\. O que é o DANFSe\?/m.exec(p[0].content)![1];return match.promise}}));
    await ready();ask('xyzxyz');assert.ok(screen.getByText('A IA está procurando uma fonte revisada…'));
    await act(async()=>match.resolve(choice));assert.ok(screen.getByRole('link',{name:'O que é o DANFSe?'}));assert.equal(calls,2);
    await act(async()=>explanation.reject(Error('private failure')));assert.equal(screen.queryByText(/private failure/),null);
    assert.ok(screen.getByText(/A geração local falhou/));assert.ok(screen.getByText('e-Leão · Guia revisado'));assert.equal(replies().length,1);
  });
});
