import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React from 'react';
import {articles} from '../src/lib/knowledge';
import type {LocalModel,ModelLoader} from '../src/lib/assistant';

test('assistente gratuito: opt-in, respostas identificadas, falha e cancelamento',async t=>{
  const dom=new JSDOM('<!doctype html><body></body>',{url:'https://example.test/e-leao/'});
  for(const key of ['window','document','navigator','HTMLElement'] as const)Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
  const {render,screen,fireEvent,cleanup,waitFor,act}=await import('@testing-library/react');
  const {default:Assistant}=await import('../src/pages/Assistant');const {Ctx}=await import('../src/lib/workspace');const {db}=await import('../src/lib/client');
  const space={knowledge:articles,feedback:async()=>{},notify:()=>{}} as React.ContextType<typeof Ctx>;
  const open=(loadModel:ModelLoader)=>render(React.createElement(Ctx.Provider,{value:space},React.createElement(Assistant,{loadModel})));
  const activate=()=>fireEvent.click(screen.getByRole('button',{name:'Ativar IA neste dispositivo'}));
  const ask=(question:string)=>{fireEvent.change(screen.getByLabelText('Sua pergunta'),{target:{value:question}});fireEvent.click(screen.getByLabelText('Enviar pergunta'))};
  t.after(async()=>{cleanup();await db.auth.dispose();await db.realtime.disconnect();dom.window.close()});
  await t.test('não baixa sem consentimento; na falha de inferência entrega o guia na mesma conversa',async t=>{
    t.after(cleanup);let loads=0,answers=0,closes=0;
    open(async()=>{loads++;return {close:()=>{closes++},complete:async prompt=>{
      answers++;assert.ok(prompt[0].content.includes('representação auxiliar'));if(answers>1)throw Error('private failure');return 'O DANFSe permite ler a nota em PDF.';
    }}});
    ask('O que é o DANFSe?');assert.equal(loads,0);assert.ok(screen.getByText('e-Leão · Guia revisado'));
    activate();await screen.findByText('Modelo pronto');ask('Explique o DANFSe.');await screen.findByText('O DANFSe permite ler a nota em PDF.');
    assert.ok(screen.getByText('e-Leão · IA local'));assert.equal(loads,1);ask('Pode resumir?');
    await screen.findByText(/A geração local falhou/);assert.equal(screen.getAllByText('Pode resumir?').length,1);
    assert.equal(screen.getAllByText('e-Leão · Guia revisado').length,2);assert.equal(closes,1);assert.equal(screen.queryByText(/private failure/),null);
  });
  await t.test('download pode falhar, ser repetido e cancelado sem resposta atrasada',async t=>{
    t.after(cleanup);let calls=0,closed=0;let finish!:(value:LocalModel)=>void;let loadingSignal:AbortSignal|undefined;
    open(async signal=>{if(!calls++)throw Error('network');loadingSignal=signal;return new Promise(r=>{finish=r})});
    activate();await screen.findByText(/Não foi possível preparar a IA/);activate();
    ask('Como emitir NFS-e?');await waitFor(()=>assert.ok(screen.getByText('e-Leão · Guia revisado')));
    fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));
    assert.ok(loadingSignal?.aborted);await act(async()=>finish({complete:async()=>'',close:()=>{closed++}}));
    assert.equal(closed,1);assert.equal(screen.queryByText('Modelo pronto'),null);
  });
  await t.test('cancelar a geração mantém a pergunta e a fonte, sem aceitar texto atrasado',async t=>{
    t.after(cleanup);let finish!:(s:string)=>void;let signal!:AbortSignal;
    open(async()=>({close:()=>{},complete:async(_prompt,s)=>{signal=s;return new Promise(r=>{finish=r})}}));
    activate();await screen.findByText('Modelo pronto');ask('Para que serve o DANFSe?');
    fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));assert.equal(signal.aborted,true);
    assert.ok(screen.getByRole('link',{name:'O que é o DANFSe?'}));
    await act(async()=>finish('Texto que chegou depois do cancelamento.'));
    assert.equal(screen.getAllByText('e-Leão · Guia revisado').length,1);
    assert.equal(screen.queryByText(/Texto que chegou depois/),null);assert.equal(screen.queryByText('e-Leão · IA local'),null);
  });
});
