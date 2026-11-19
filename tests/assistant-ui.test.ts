import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React from 'react';
import {articles} from '../src/lib/knowledge';
import {transitionGuide} from '../src/lib/rateReferences';
import {answerIdleMs,answerLimitMs,type LocalModel,type ModelLoader,type ModelProgress} from '../src/lib/assistant';

function deferred<T>() {
  let resolve!:(value:T)=>void,reject!:(e:Error)=>void;
  const promise=new Promise<T>((ok,fail)=>{resolve=ok;reject=fail});return {promise,resolve,reject};
}
test('assistente gratuito: início automático e respostas visíveis sem cancelar',async t=>{
  const dom=new JSDOM('<!doctype html><body></body>',{url:'https://example.test/e-leao/'});
  for(const key of ['window','document','navigator','HTMLElement'] as const)Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
  const {render,screen,fireEvent,cleanup,waitFor,act}=await import('@testing-library/react');
  const {default:Assistant}=await import('../src/pages/Assistant');const {Ctx}=await import('../src/lib/workspace');const {db}=await import('../src/lib/client');
  const space={knowledge:articles,feedback:async()=>{},notify:()=>{}} as React.ContextType<typeof Ctx>;
  const open=(loadModel:ModelLoader)=>render(React.createElement(React.StrictMode,null,React.createElement(Ctx.Provider,{value:space},React.createElement(Assistant,{loadModel}))));
  const ask=(question:string)=>{fireEvent.change(screen.getByLabelText('Sua pergunta'),{target:{value:question}});fireEvent.click(screen.getByLabelText('Enviar pergunta'))};
  const replies=()=>screen.getByRole('log').querySelectorAll('.bubble.agent');
  const plain={close:()=>{},complete:async()=>''};
  t.afterEach(()=>{cleanup();dom.window.localStorage.clear()});
  t.after(async()=>{await db.auth.dispose();await db.realtime.disconnect();dom.window.close()});

  await t.test('abre uma vez, inclusive em StrictMode; a pergunta da imagem recebe o guia imediatamente',async()=>{
    const load=deferred<LocalModel>();let loads=0,calls=0,closed=0;
    const page=open(async()=>{loads++;return load.promise});await waitFor(()=>assert.equal(loads,1));
    fireEvent.click(screen.getByRole('button',{name:transitionGuide.question}));
    assert.ok(screen.getByText(transitionGuide.answer));assert.ok(screen.getByRole('link',{name:transitionGuide.question}));
    await act(async()=>load.resolve({close:()=>{closed++},complete:async()=>{calls++;return ''}}));
    await screen.findByText('Modelo pronto');ask(transitionGuide.question.toUpperCase().replace('?',''));
    assert.equal(screen.getAllByText(transitionGuide.answer).length,2);assert.equal(calls,0);
    assert.equal(screen.queryByRole('button',{name:/Cancelar/}),null);assert.equal(replies().length,2);
    page.unmount();assert.equal(closed,1);
  });
  await t.test('durante a carga já responde; explica a última pergunta livre usando o mesmo balão e valida o texto final',async()=>{
    const load=deferred<LocalModel>(),result=deferred<string>();let calls=0,pulse!:ModelProgress;
    open(async()=>load.promise);ask('Preciso de ajuda com IBS');ask('Para que serve o DANFSe?');
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
    ask('Explique o DANFSe');fireEvent.click(screen.getByRole('button',{name:'Usar só os guias'}));assert.ok(signal.aborted);
    await act(async()=>late.resolve({...plain,close:()=>{closed++}}));assert.equal(closed,1);assert.equal(screen.queryByText('Modelo pronto'),null);
    page.unmount();page=open(loader);await act(async()=>{});assert.equal(loads,2);
    fireEvent.click(screen.getByRole('button',{name:'Voltar a usar a IA'}));await screen.findByText('Modelo pronto');assert.equal(loads,3);
    page.unmount();open(loader);await screen.findByText('Modelo pronto');assert.equal(loads,4);
  });
  await t.test('sem progresso, finaliza sozinha, preserva a resposta, libera a próxima pergunta e descarta o resultado tardio',async t=>{
    const late=deferred<string>();let loads=0,signal!:AbortSignal;
    open(async()=>++loads===1?{close:()=>{},complete:async(_p,s)=>{signal=s;return late.promise}}:{close:()=>{},complete:async()=>'Essa nota precisa de autorização no emissor.'});
    await screen.findByText('Modelo pronto');t.mock.timers.enable({apis:['setTimeout']});
    ask('Explique o DANFSe');assert.ok(screen.getByText('e-Leão · Guia revisado'));assert.ok(!signal.aborted);
    await act(async()=>t.mock.timers.tick(answerIdleMs+1));assert.ok(signal.aborted);assert.equal(loads,2);
    assert.equal(screen.queryByRole('button',{name:/Cancelar explicação/}),null);assert.ok(screen.getByText(/A IA demorou para concluir/));
    await act(async()=>late.resolve('Resposta atrasada.'));assert.equal(screen.queryByText('Resposta atrasada.'),null);assert.equal(replies().length,1);
    ask('Explique a emissão de NFS-e.');await act(async()=>{});assert.ok(screen.getByText('Essa nota precisa de autorização no emissor.'));assert.equal(replies().length,2);
  });
  await t.test('há limite total mesmo com o worker enviando progresso continuamente',async t=>{
    let signal!:AbortSignal,pulse!:ModelProgress,calls=0;
    open(async()=>({close:()=>{},complete:async(_p,s,_max,progress)=>{calls++;signal=s;pulse=progress!;return new Promise(()=>{})}}));
    await screen.findByText('Modelo pronto');t.mock.timers.enable({apis:['setTimeout']});ask('Explique o DANFSe.');
    await act(async()=>{for(let elapsed=0;elapsed<answerLimitMs;elapsed+=1000){t.mock.timers.tick(1000);pulse('writing')}});
    assert.ok(signal.aborted);assert.equal(calls,1);assert.ok(screen.getByText(/A IA demorou para concluir/));assert.equal(replies().length,1);
  });
  await t.test('outra pergunta não exige cancelar: FAQ não disputa o worker e a pergunta livre mais recente recebe a explicação',async()=>{
    const old=deferred<string>();let oldSignal!:AbortSignal,loads=0;
    open(async()=>++loads===1?{close:()=>{},complete:async(_p,s)=>{oldSignal=s;return old.promise}}:{close:()=>{},complete:async p=>{
      assert.equal(p[1].content,'Como preparo um rascunho?');return 'Confira os dados do rascunho antes de acessar o emissor.';
    }});
    await screen.findByText('Modelo pronto');ask('Explique o DANFSe.');ask(transitionGuide.question);
    assert.ok(screen.getByText(transitionGuide.answer));assert.ok(!oldSignal.aborted);
    ask('Como preparo um rascunho?');await screen.findByText('Confira os dados do rascunho antes de acessar o emissor.');
    await act(async()=>old.resolve('Texto descartado.'));assert.equal(screen.queryByText('Texto descartado.'),null);
    assert.ok(oldSignal.aborted);assert.equal(loads,2);assert.equal(replies().length,3);
  });
  await t.test('cancelar ou sair não duplica a resposta nem reabre a geração antiga',async()=>{
    const late=deferred<string>();let signal!:AbortSignal,closed=0,loads=0;
    const page=open(async()=>{loads++;return {close:()=>{closed++},complete:async(_p,s)=>{signal=s;return late.promise}}});
    await screen.findByText('Modelo pronto');ask('Para que serve o DANFSe?');assert.ok(screen.getByRole('link',{name:'O que é o DANFSe?'}));
    fireEvent.click(screen.getByRole('button',{name:'Cancelar explicação'}));assert.ok(signal.aborted);await screen.findByText('Modelo pronto');
    assert.equal(replies().length,1);assert.equal(loads,2);assert.equal(closed,1);
    ask('Explique melhor');assert.ok(!signal.aborted);page.unmount();assert.ok(signal.aborted);assert.equal(closed,2);
    await act(async()=>late.resolve('Texto antigo.'));assert.equal(screen.queryByText('Texto antigo.'),null);assert.equal(loads,2);
  });
  await t.test('rota sem correspondência mostra a fonte assim que identificada e não deixa a conversa pendente após erro',async()=>{
    const match=deferred<string>(),explanation=deferred<string>();let calls=0;
    open(async()=>({close:()=>{},complete:async(_p,_s,max)=>{calls++;return max===8?match.promise:explanation.promise}}));
    await screen.findByText('Modelo pronto');ask('xyzxyz');assert.ok(screen.getByText('A IA está procurando uma fonte revisada…'));
    await act(async()=>match.resolve('6'));assert.ok(screen.getByRole('link',{name:'O que é o DANFSe?'}));assert.equal(calls,2);
    await act(async()=>explanation.reject(Error('private failure')));assert.equal(screen.queryByText(/private failure/),null);
    assert.ok(screen.getByText(/A geração local falhou/));assert.ok(screen.getByText('e-Leão · Guia revisado'));assert.equal(replies().length,1);
  });
});
