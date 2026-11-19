import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import type {Operation} from '../src/lib/types';

test('do cenário ao histórico e ao motor RTC',async t=>{
  const dom = new JSDOM('<!doctype html><body></body>',{url:'https://example.test/',pretendToBeVisual:true});
  for (const key of ['window','document','navigator','HTMLElement','Event','FormData','requestAnimationFrame'] as const) Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
  dom.window.HTMLDialogElement.prototype.showModal = function(){this.open=true};
  dom.window.HTMLDialogElement.prototype.close = function(){this.open=false};
  const {render,screen,within,fireEvent,cleanup} = await import('@testing-library/react');
  const {default:userEvent} = await import('@testing-library/user-event');
  const {Ctx} = await import('../src/lib/workspace');
  const {db} = await import('../src/lib/client');
  const {default:Calculator} = await import('../src/pages/Calculator');
  const {default:History} = await import('../src/pages/History');
  const saved: Operation[] = [];
  function open(page: React.ReactElement, operations: Operation[] = []) {
    const value = {save:async(o:Operation)=>{saved.push(o)}, operations,period:'2026-11',notify:()=>{},session:{user:{id:'membro-de-teste'}}} as React.ContextType<typeof Ctx>;
    render(React.createElement(Ctx.Provider,{value},page));return userEvent.setup();
  }
  const date = (v:string) => fireEvent.change(screen.getByLabelText('Fato gerador'),{target:{value:v}});
  t.after(async()=>{cleanup();await db.auth.dispose();await db.realtime.disconnect();dom.window.close()});
  await t.test('a escolha filtra por termo ou código; só aplica a referência após conferir os requisitos',async t=>{
    t.after(cleanup);
    const u=open(React.createElement(Calculator));date('2026-11-18');
    const picker = screen.getByRole('combobox',{name:'Nome do cenário'}) as HTMLSelectElement;
    assert.equal(picker.options.length,214); // 208 registros da fonte + 5 nomes usuais + personalizado
    const filter = screen.getByRole('searchbox',{name:'Filtrar cenários'});
    await u.type(filter,'educacao');await u.selectOptions(picker,'ibsCbs:200028');
    assert.ok(screen.getByRole('link',{name:/LC 214\/2025, Art. 129/i}));
    assert.equal(screen.queryByRole('button',{name:/Usar referência/}),null);
    assert.equal((screen.getByRole('button',{name:'Calcular estimativa'}) as HTMLButtonElement).disabled,true);
    await u.clear(filter);await u.type(filter,'zzzzz');assert.equal(picker.value,'ibsCbs:200028');assert.match(screen.getByRole('status').textContent!,/Nenhuma opção/);await u.clear(filter);
    await u.click(screen.getByRole('checkbox',{name:/Conferi as condições/}));
    await u.type(screen.getByLabelText(/Base tributável ajustada/),'1000');
    await u.click(screen.getByRole('button',{name:'Usar referência de 0,36% para CBS'}));
    await u.click(screen.getByRole('button',{name:'Usar referência de 0,04% para IBS'}));
    await u.click(screen.getByRole('button',{name:'Calcular estimativa'}));
    const memory=screen.getByRole('region',{name:'Memória de cálculo'});assert.match(memory.textContent!,/R\$\s*4,00/);assert.match(memory.textContent!,/1\.000,00 × 0,36%/);assert.match(memory.textContent!,/Não incluído/);
    await u.click(screen.getByRole('button',{name:'Salvar simulação'}));assert.equal(saved.at(-1)!.details.cenarioId,'ibsCbs:200028');
    date('2027-02-15');assert.equal(screen.queryByRole('region',{name:'Memória de cálculo'}),null);
    await u.click(screen.getByRole('checkbox',{name:/Conferi as condições/}));
    assert.equal((screen.getByLabelText('Alíquota CBS (%)') as HTMLInputElement).value,'');assert.equal(screen.queryByRole('button',{name:/referência.*CBS/i}),null);
    await u.selectOptions(picker,'ibsCbs:200003');date('2026-11-18');await u.click(screen.getByRole('checkbox',{name:/Conferi as condições/}));
    assert.equal((screen.getByLabelText('Alíquota total IBS (%)') as HTMLInputElement).value,'');assert.ok(screen.getByRole('button',{name:'Usar referência de 0% para CBS'}));
    await u.click(screen.getByRole('button',{name:'Aplicar sugestões: CBS 0% · IBS 0%'}));await u.click(screen.getByRole('button',{name:'Calcular estimativa'}));
    assert.match(screen.getByRole('region',{name:'Memória de cálculo'}).textContent!,/R\$\s*0,00/);
    fireEvent.change(screen.getByLabelText('Alíquota CBS (%)'),{target:{value:'1'}});await u.click(screen.getByRole('button',{name:'Calcular estimativa'}));
    assert.match(screen.getByRole('region',{name:'Memória de cálculo'}).textContent!,/CBS: 1% informado, referência do cenário 0%/);
    await u.selectOptions(picker,'manual');assert.ok(screen.getByLabelText('Título personalizado'));assert.equal(screen.queryByRole('button',{name:'Usar referência de 0% para CBS'}),null);
  });
  await t.test('histórico exibe o snapshot, permite busca por código e não atribui regras a memória antiga',async t=>{
    t.after(cleanup);const o=saved.at(-1)!;
    const legacy={...o,id:'antigo',title:'Memória antiga',details:{origem:'Cenário ilustrativo com percentuais hipotéticos.'}};
    const u=open(React.createElement(History),[o,legacy]);
    const search=screen.getByLabelText('Buscar operação');await u.type(search,'200028');assert.equal(screen.queryByText('Memória antiga'),null);
    await u.click(screen.getByRole('button',{name:`Ver detalhes: ${o.title}`}));
    const modal=within(screen.getByRole('dialog'));assert.match(modal.getByRole('region',{name:'Memória de cálculo'}).textContent!,/Referência aplicada.*348, III, a.*129/);
    assert.ok(modal.getByRole('link',{name:/LC 214\/2025, Art. 129/i}));await u.click(modal.getByRole('button',{name:'Fechar janela'}));
    await u.clear(search);await u.click(screen.getByRole('button',{name:'Ver detalhes: Memória antiga'}));const old=screen.getByRole('dialog');
    assert.doesNotMatch(old.textContent!,/Referência aplicada|Art. 129|Premissas confirmadas/);assert.match(old.textContent!,/percentuais hipotéticos/);
  });
  await t.test('seleção complexa não calcula localmente; encaminha o contrato certo e não consulta um modelo incompleto',async t=>{
    t.after(cleanup);
    const invoke=t.mock.method(Object.getPrototypeOf(db.functions),'invoke',async()=>({data:{objetos:[{nObj:1,estadoItem:'NAO_CALCULADO'}]},error:null,response:new Response(null,{status:200})}));
    const u=open(React.createElement(Calculator));date('2026-11-18');
    await u.selectOptions(screen.getByLabelText('Nome do cenário'),'sn:09');assert.ok(screen.getByRole('alert'));
    assert.equal((screen.getByLabelText('Regime tributário') as HTMLSelectElement).value,'Simples Nacional');assert.equal(screen.queryByRole('button',{name:/Preparar consulta/}),null);
    date('2027-01-15');assert.equal(screen.queryByLabelText(/Alíquota.*CBS/),null);assert.equal(screen.queryByRole('button',{name:'Calcular estimativa'}),null);
    await u.click(screen.getByRole('button',{name:'Preparar consulta ao motor'}));assert.equal((screen.getByLabelText('Serviço') as HTMLSelectElement).value,'simple');
    const editor=screen.getByLabelText('Operação (JSON)') as HTMLTextAreaElement;
    const op=JSON.parse(editor.value);assert.equal(op.itens[0].cAtivSN,'09');assert.equal(op.data,'2027-01-15');
    await u.click(screen.getByRole('button',{name:'Consultar motor'}));assert.match(screen.getByRole('alert').textContent!,/Complete os campos/);assert.equal(invoke.mock.callCount(),0);
    op.CRT='1';op.tpDoc='91';Object.assign(op.itens[0],{baseCalculo:'350.00',valorImpostoSeletivo:'0.00',cClassTrib:'000001',pIBSSN:'1.11',pCBSSN:'2.22'});
    fireEvent.change(editor,{target:{value:JSON.stringify(op)}});await u.click(screen.getByRole('button',{name:'Consultar motor'}));assert.equal(invoke.mock.callCount(),1);
    assert.equal(invoke.mock.calls[0].arguments[1].body.action,'simple');assert.deepEqual(invoke.mock.calls[0].arguments[1].body.payload,op);
    assert.ok(screen.getByText(/Resultado parcial/));assert.ok(screen.getByText('Estados por item (1)'));assert.equal(screen.queryByRole('button',{name:'Salvar simulação'}),null);
  });
});
