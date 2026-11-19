import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React,{useState} from 'react';

test('convite e recuperação permanecem visíveis para copiar; outras ações atualizam o espaço',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://example.test/e-leao/'});
 Object.defineProperty(globalThis,'window',{value:dom.window,configurable:true});
 Object.defineProperty(globalThis,'document',{value:dom.window.document,configurable:true});
 Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
 Object.defineProperty(globalThis,'location',{value:dom.window.location,configurable:true});
 Object.defineProperty(globalThis,'HTMLElement',{value:dom.window.HTMLElement,configurable:true});
 Object.defineProperty(globalThis,'HTMLDialogElement',{value:dom.window.HTMLDialogElement,configurable:true});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
 dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
 let copied='';Object.defineProperty(dom.window.navigator,'clipboard',{value:{writeText:async(s:string)=>{copied=s}},configurable:true});
 const {render,screen,fireEvent,waitFor,cleanup}=await import('@testing-library/react');
 const {Ctx}=await import('../src/lib/workspace');const {db}=await import('../src/lib/client');const {default:Admin}=await import('../src/pages/Admin');
 const oldFrom=db.from,oldRpc=db.rpc;let reloads=0;const calls:string[]=[];
 const owner={id:'owner',display_name:'Dono',role:'admin',active:true,approval_status:'approved'};
 const member={id:'member',display_name:'Membro',role:'member',active:true,approval_status:'approved'};
 (db as any).from=(table:string)=>({select:()=>({order:()=>({range:async()=>({data:table==='eleao_profiles'?[owner,member]:[],error:null})})})});
 (db as any).rpc=async(name:string)=>{calls.push(name);if(name==='eleao_list_access_requests')return {data:[{id:'request',display_name:'Visitante',email:'visitante@example.test',status:'pending'}],error:null};return {data:null,error:null}};
 function Harness(){const [loading,setLoading]=useState(false);const value:any={profile:owner,period:'2026-11',operations:[],setPeriod:()=>{},notify:()=>{},knowledge:[],reload:()=>{reloads++;setLoading(true)}};return React.createElement(Ctx.Provider,{value},loading?React.createElement('div',null,'Recarregando espaço'):React.createElement(Admin))}
 try{
  render(React.createElement(Harness));
  fireEvent.click(await screen.findByRole('button',{name:/Solicitações/}));
  fireEvent.click(screen.getByRole('button',{name:'Gerar convite'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirmar'}));
  // A labelled input may already exist before the effect calls showModal().
  await screen.findByRole('dialog',{name:'Convite gerado'});
  const link=screen.getByLabelText('Link pessoal') as HTMLInputElement;
  assert.match(link.value,/^https:\/\/example\.test\/#\/convite\/[0-9a-f]{64}$/);
  assert.equal(reloads,0);assert.ok(calls.includes('eleao_issue_invite'));
  fireEvent.click(screen.getByRole('button',{name:'Copiar link'}));await waitFor(()=>assert.equal(copied,link.value));
  await new Promise(r=>setTimeout(r,10));assert.ok(screen.getByLabelText('Link pessoal'));
  fireEvent.click(screen.getByRole('button',{name:'Fechar'}));
  fireEvent.click(screen.getByRole('button',{name:'Usuários'}));
  fireEvent.click(screen.getByRole('button',{name:'Recuperar senha'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirmar'}));
  await screen.findByRole('dialog',{name:'Convite gerado'});
  const reset=screen.getByLabelText('Link pessoal') as HTMLInputElement;
  assert.match(reset.value,/^https:\/\/example\.test\/#\/recuperacao\/[0-9a-f]{64}$/);
  assert.equal(reloads,0);assert.ok(calls.includes('eleao_issue_password_reset'));
  fireEvent.click(screen.getByRole('button',{name:'Fechar'}));
  fireEvent.click(screen.getByRole('button',{name:/Solicitações/}));
  fireEvent.click(screen.getByRole('button',{name:'Recusar'}));fireEvent.click(screen.getByRole('button',{name:'Confirmar'}));
  await waitFor(()=>assert.equal(reloads,1));assert.ok(screen.getByText('Recarregando espaço'));
 }finally{cleanup();await db.auth.dispose();await db.realtime.disconnect();(db as any).from=oldFrom;(db as any).rpc=oldRpc;dom.window.close()}
});
