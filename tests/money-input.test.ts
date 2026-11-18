import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import React from 'react';
import type {Operation} from '../src/lib/types';

test('campos em reais exibem separadores sem mudar os valores fiscais', async t => {
  const dom = new JSDOM('<!doctype html><body></body>', {url: 'https://example.test/', pretendToBeVisual: true});
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Event', 'FormData', 'requestAnimationFrame'] as const) {
    Object.defineProperty(globalThis, key, {value: dom.window[key], configurable: true});
  }
  dom.window.HTMLDialogElement.prototype.showModal = function () {this.open = true};
  dom.window.HTMLDialogElement.prototype.close = function () {this.open = false};
  const {render, screen, cleanup} = await import('@testing-library/react');
  const {default: userEvent} = await import('@testing-library/user-event');
  const {Ctx} = await import('../src/lib/workspace');
  const {db} = await import('../src/lib/client');
  const {default: Calculator} = await import('../src/pages/Calculator');
  const {default: Notes} = await import('../src/pages/Notes');
  const saved: Operation[] = [];
  function open(page: React.ReactElement, operations: Operation[] = []) {
    const value = {operations, save: async (op: Operation) => {saved.push(op)}, notify: () => {}} as React.ContextType<typeof Ctx>;
    render(React.createElement(Ctx.Provider, {value}, page));
    return userEvent.setup();
  }
  t.after(async () => {cleanup(); await db.auth.dispose(); await db.realtime.disconnect(); dom.window.close()});

  await t.test('agrupa durante a digitação, permite centavos e preserva alíquotas com quatro casas', async t => {
    t.after(cleanup);
    const user = open(React.createElement(Calculator));
    const base = screen.getByLabelText(/Base tributável ajustada/) as HTMLInputElement;
    await user.type(base, '16132131');
    assert.equal(base.value, '16.132.131,00');
    await user.keyboard(',09');
    assert.equal(base.value, '16.132.131,09');
    await user.type(screen.getByLabelText('Alíquota CBS (%)'), '2,7505');
    await user.type(screen.getByLabelText('Alíquota total IBS (%)'), '0');
    await user.click(screen.getByLabelText(/Incluir Imposto Seletivo/));
    const isBase = screen.getByLabelText('Base própria do IS (R$)') as HTMLInputElement;
    await user.clear(isBase);
    assert.equal(isBase.value, '');
    await user.paste('1.234,56');
    assert.equal(isBase.value, '1.234,56');
    await user.clear(screen.getByLabelText('Alíquota do IS (%)'));
    await user.keyboard('10');
    await user.click(screen.getByRole('button', {name: 'Calcular estimativa'}));
    await user.click(screen.getByRole('button', {name: 'Salvar simulação'}));
    const op = saved.at(-1)!;
    assert.equal(op.base_cents, 1613213109);
    assert.equal(op.cbs_cents, 44371427);
    assert.equal(op.is_cents, 12346);
  });

  await t.test('editar rascunho preserva centavos e não confunde ponto decimal colado com milhar', async t => {
    t.after(cleanup);
    const item: Operation = {id: 'nota', kind: 'invoice', title: 'Serviço', on_date: '2026-11-18',
      regime: 'Regime regular', base_cents: 125075, cbs_cents: 0, ibs_cents: 0, is_cents: 0,
      details: {prestador: 'A', tomador: 'B', municipio: 'Rio', descricao: 'Serviço'}, created_at: '2026-11-18T12:00:00Z'};
    const user = open(React.createElement(Notes), [item]);
    await user.click(screen.getByRole('button', {name: 'Editar Serviço'}));
    const amount = screen.getByLabelText('Valor do serviço (R$)') as HTMLInputElement;
    assert.equal(amount.value, '1.250,75');
    await user.click(amount);
    amount.select();
    await user.paste('-1250');
    assert.equal(amount.value, '1.250,75');
    assert.match(screen.getByRole('alert').textContent!, /Valor não colado/);
    await user.paste('1250.50');
    assert.equal(amount.value, '1.250,50');
    await user.click(screen.getByRole('button', {name: 'Salvar rascunho'}));
    assert.equal(saved.at(-1)?.base_cents, 125050);
  });
});
